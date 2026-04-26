import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GROQ_API_KEY;
	if (!apiKey) {
		return json({ error: 'Groq API key not configured' }, { status: 500 });
	}

	const body = await request.json();

	const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: body.model,
			messages: body.messages,
			stream: true,
		}),
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
