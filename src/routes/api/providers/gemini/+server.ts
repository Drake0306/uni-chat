import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		return json({ error: 'Gemini API key not configured' }, { status: 500 });
	}

	const body = await request.json();

	// Convert OpenAI-style messages to Gemini format
	const contents = body.messages.map((msg: { role: string; content: string }) => ({
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: msg.content }],
	}));

	// Extract system message if present
	const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
	const nonSystemContents = contents.filter((_: unknown, i: number) => body.messages[i].role !== 'system');

	const geminiBody: Record<string, unknown> = {
		contents: nonSystemContents,
	};
	if (systemMsg) {
		geminiBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
	}
	if (body.thinking) {
		geminiBody.generationConfig = {
			thinkingConfig: { thinkingBudget: 8192 },
		};
	}

	const model = body.model || 'gemini-2.5-flash';
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(geminiBody),
	});

	if (!response.ok) {
		const status = response.status;
		let message = 'Something went wrong with Gemini.';
		try {
			const errBody = await response.json();
			if (status === 429) {
				message = 'This model\'s quota is exhausted for now. Please try a different model or try again later.';
			} else if (errBody?.error?.message) {
				message = errBody.error.message.split('\n')[0];
			}
		} catch {
			// fallback to generic message
		}
		return json({ error: message }, { status });
	}

	// Transform Gemini SSE to OpenAI-compatible SSE
	const reader = response.body?.getReader();
	if (!reader) {
		return json({ error: 'No response body' }, { status: 500 });
	}

	const stream = new ReadableStream({
		async start(controller) {
			const decoder = new TextDecoder();
			const encoder = new TextEncoder();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
						break;
					}

					const text = decoder.decode(value, { stream: true });
					const lines = text.split('\n');

					for (const line of lines) {
						if (!line.startsWith('data: ')) continue;
						const data = line.slice(6).trim();
						if (!data) continue;

						try {
							const parsed = JSON.parse(data);
							const parts = parsed.candidates?.[0]?.content?.parts;
							if (parts && Array.isArray(parts)) {
								for (const part of parts) {
									if (!part.text) continue;
									const chunk = {
										choices: [{
											delta: part.thought
												? { reasoning_content: part.text }
												: { content: part.text },
											index: 0,
										}],
									};
									controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
								}
							}
						} catch {
							// Skip unparseable chunks
						}
					}
				}
			} catch {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		},
	});
};
