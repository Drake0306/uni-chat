import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// OpenAI chat-completions passthrough. Forwards the body more-or-less as
// the inner /api/chat router built it — the request shape is already
// OpenAI-native (string content for text-only messages, content blocks for
// vision messages: `[{type:'text'}, {type:'image_url', image_url:{url}}]`),
// so we don't transform anything; we just attach the API key, set the
// model, and stream the SSE response straight back to the client.
//
// Gated on:
//   - OPENAI_API_KEY env var (returns 500 with actionable message if unset)
//   - the model's `enabled: true` flag in models.ts (handled upstream by
//     /api/chat). Today every OpenAI entry is enabled:false, so this route
//     is a paid-tier opt-in even with the key configured.
//
// Reasoning effort is mapped to OpenAI's `reasoning_effort` param for the
// o-series models (o1, o3, o4-mini, etc.); the `thinking` flag is ignored
// for non-reasoning models (gpt-4o, gpt-4.1) since they don't support it.

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		return json(
			{
				error:
					'OpenAI API key not configured. Set OPENAI_API_KEY in .env to use GPT and o-series models.',
			},
			{ status: 500 }
		);
	}

	const body = await request.json();
	const model = body.model || 'gpt-4o';
	// Reasoning models start with o1, o3, o4, etc. — they accept the
	// `reasoning_effort` param. Other GPT models (gpt-4o, gpt-4.1) ignore
	// thinking entirely.
	const isReasoningModel = /^o\d/i.test(model);

	const openaiBody: Record<string, unknown> = {
		model,
		messages: body.messages,
		stream: true,
	};
	if (body.thinking && isReasoningModel) {
		const effort = body.effort === 'low' || body.effort === 'high' ? body.effort : 'medium';
		openaiBody.reasoning_effort = effort;
	}

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(openaiBody),
	});

	if (!response.ok) {
		const status = response.status;
		let message = 'Something went wrong with OpenAI.';
		try {
			const errBody = await response.json();
			if (status === 429) {
				message =
					"OpenAI rate limit / quota exhausted. Try again later or switch to a different model.";
			} else if (errBody?.error?.message) {
				message = errBody.error.message.split('\n')[0];
			}
		} catch {
			// fall back to generic
		}
		return json({ error: message }, { status });
	}

	// OpenAI's SSE format already matches what chat-view expects
	// (`data: {choices:[{delta:{content}}]}` per chunk + `data: [DONE]`).
	// Pass it through untouched.
	return new Response(response.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
};
