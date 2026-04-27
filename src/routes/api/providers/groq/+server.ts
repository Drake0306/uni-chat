import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GROQ_API_KEY;
	if (!apiKey) {
		return json({ error: 'Groq API key not configured' }, { status: 500 });
	}

	const body = await request.json();

	const groqBody: Record<string, unknown> = {
		model: body.model,
		messages: body.messages,
		stream: true,
	};
	// reasoning_effort values are model-family-specific on Groq:
	//   • openai/gpt-oss-120b, openai/gpt-oss-20b → 'low' | 'medium' | 'high'
	//   • qwen/qwen3-32b                          → 'none' | 'default'
	// Sending the wrong vocabulary throws "reasoning_effort must be one of …".
	// Fast mode never reaches here (server omits `body.thinking`), so we only
	// need to map the on-states.
	if (body.thinking && body.effort) {
		const modelId = typeof body.model === 'string' ? body.model : '';
		if (modelId.startsWith('qwen/')) {
			// Qwen treats reasoning as binary; any of our low/medium/high
			// flatten to 'default' (thinking on).
			groqBody.reasoning_effort = 'default';
		} else {
			// GPT-OSS family — pass our value through.
			groqBody.reasoning_effort = body.effort;
		}
	}

	const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(groqBody),
	});

	if (!response.ok) {
		const status = response.status;
		let message = 'Something went wrong with Groq.';
		try {
			const errBody = await response.json();
			if (status === 429) {
				message = 'Rate limit reached. Please try a different model or try again later.';
			} else if (errBody?.error?.message) {
				message = errBody.error.message.split('\n')[0];
			}
		} catch {
			// fallback to generic message
		}
		return json({ error: message }, { status });
	}

	return new Response(response.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		},
	});
};
