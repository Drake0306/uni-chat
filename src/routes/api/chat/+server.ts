import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findModel } from '$lib/config/models.js';
import { checkRateLimit, type Tier } from '$lib/server/rate-limit.js';
import { getAuthUser, getServiceClient } from '$lib/server/supabase.js';
import { accumulateAndSave } from '$lib/server/stream-persist.js';
import { searchWeb, formatSearchContext } from '$lib/server/web-search.js';
import type { RequestHandler } from './$types';

type ChatMessage = { role: string; content: string };

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();
	const { companyId, modelId, messages, chatId, messageId } = body;

	if (!companyId || !modelId || !messages) {
		return json({ error: 'Missing companyId, modelId, or messages' }, { status: 400 });
	}

	// Determine auth state and rate limit identity
	const user = await getAuthUser(request);
	let rateLimitKey: string;
	let tier: Tier = 'guest';

	if (user) {
		rateLimitKey = user.id;
		// Fetch tier from profiles
		const { data: profile } = await getServiceClient()
			.from('profiles')
			.select('tier')
			.eq('id', user.id)
			.single();
		tier = (profile?.tier as Tier) ?? 'free';
	} else {
		rateLimitKey =
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			request.headers.get('cf-connecting-ip') ||
			'unknown';
	}

	const rateCheck = checkRateLimit(rateLimitKey, tier, { BYPASS_RATE_LIMIT: env.BYPASS_RATE_LIMIT });
	if (!rateCheck.allowed) {
		return json(
			{ error: 'Rate limit exceeded. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
		);
	}

	const model = findModel(companyId, modelId);
	if (!model) {
		return json({ error: `Unknown model: ${modelId}` }, { status: 400 });
	}

	if (!model.enabled) {
		return json({ error: `${model.name} requires a Pro subscription.` }, { status: 403 });
	}

	// Reasoning effort. Client picks Fast / Low / Medium / High. Fast omits
	// the `thinking` flag entirely (the absence of the flag is the signal).
	// Other levels enable thinking with that effort. No tier gating — quota
	// pressure is handled by the rate limiter, not by hiding the feature.
	const wantsThinking = !!body.thinking && model.capabilities.thinking;
	const validEfforts = new Set(['low', 'medium', 'high']);
	const effort: 'low' | 'medium' | 'high' = validEfforts.has(body.effort)
		? body.effort
		: 'medium';

	// Web search: pre-injection via Tavily. We run a search, prepend the
	// snippets to the most recent user message, and forward the augmented
	// messages to the provider. See docs/web-search.md for the rationale.
	//
	// Config-level errors (no API key) fail loudly so the user sees a
	// clear message in chat instead of a silent fall-through that just
	// looks like the model can't access the web. Runtime failures (key
	// is set but Tavily errored) still fall back silently — those are
	// transient and shouldn't break the chat.
	if (body.webSearch && !env.TAVILY_API_KEY) {
		return json(
			{
				error:
					'Web search is on but TAVILY_API_KEY is not configured. Add it to .env (free key at https://app.tavily.com/) and restart the dev server. Alternatively, turn the Search toggle off.',
			},
			{ status: 503 }
		);
	}

	let outboundMessages: ChatMessage[] = messages;
	if (body.webSearch) {
		const lastIdx = (() => {
			for (let i = messages.length - 1; i >= 0; i--) {
				if (messages[i]?.role === 'user') return i;
			}
			return -1;
		})();
		const lastUser = lastIdx >= 0 ? messages[lastIdx] : null;
		if (lastUser?.content) {
			const results = await searchWeb(lastUser.content);
			if (results) {
				const augmented = formatSearchContext(results, lastUser.content);
				outboundMessages = messages.map((m: ChatMessage, i: number) =>
					i === lastIdx ? { ...m, content: augmented } : m
				);
			}
		}
	}

	// Route to the correct provider endpoint using the model's internal route
	const response = await fetch(model.route, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: model.apiModelId,
			messages: outboundMessages,
			...(wantsThinking && { thinking: true, effort }),
		}),
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({ error: 'Provider error' }));
		return json(err, { status: response.status });
	}

	const sseHeaders = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	};

	if (response.body && chatId && messageId && user) {
		const [clientStream, serverStream] = response.body.tee();
		accumulateAndSave(serverStream, chatId, messageId, model.name).catch((err) =>
			console.error('[api/chat] Background save failed:', err)
		);
		return new Response(clientStream, { headers: sseHeaders });
	}

	return new Response(response.body, { headers: sseHeaders });
};
