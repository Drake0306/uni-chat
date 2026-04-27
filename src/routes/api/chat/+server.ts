import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findModel } from '$lib/config/models.js';
import { checkRateLimit, type Tier } from '$lib/server/rate-limit.js';
import { getAuthUser, getServiceClient } from '$lib/server/supabase.js';
import { accumulateAndSave } from '$lib/server/stream-persist.js';
import type { RequestHandler } from './$types';

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

	// Reasoning effort: paid tiers only. Free/guest get "fast" mode (no
	// thinking param sent at all). Server-side gate so a spoofed request
	// can't bypass tier limits.
	const userIsPaid = tier === 'pro' || tier === 'max';
	const wantsThinking = !!body.thinking && userIsPaid && !!model.effortLevels;
	const validEfforts = new Set(['low', 'medium', 'high']);
	const effort: 'low' | 'medium' | 'high' = validEfforts.has(body.effort)
		? body.effort
		: 'medium';

	// Route to the correct provider endpoint using the model's internal route
	const response = await fetch(model.route, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: model.apiModelId,
			messages,
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
