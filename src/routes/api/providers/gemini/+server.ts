import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { LLMContentBlock } from '$lib/types.js';
import type { RequestHandler } from './$types';

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

// Gemini's inline_data has a ~20 MB hard limit on the request body. Base64
// encoding inflates raw bytes by 4/3, so the source image must stay under
// ~15 MB to fit. Anything larger is dropped with a console warn — the rest
// of the message still goes through. Our app-level cap is 25 MB per file
// (file-extract.ts MAX_FILE_BYTES); the gap is intentional so non-Gemini
// providers (which fetch URLs themselves) aren't artificially restricted.
const GEMINI_MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Pull text out of a possibly-array content. Used for the system message
// where we always want a flat string.
function extractText(content: string | LLMContentBlock[]): string {
	if (typeof content === 'string') return content;
	return content
		.filter((b): b is { type: 'text'; text: string } => b.type === 'text')
		.map((b) => b.text)
		.join('\n\n');
}

// Fetch each image_url block server-side, base64-encode, emit it as
// Gemini's inline_data part. On fetch failure (signed URL expired, RLS
// blocked, network), skip the image with a warn — better to send the
// model the rest of the conversation than to fail the whole request.
async function blockToParts(block: LLMContentBlock): Promise<Part[]> {
	if (block.type === 'text') return [{ text: block.text }];
	try {
		const res = await fetch(block.image_url.url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		// Pre-check via Content-Length to avoid pulling a 25 MB body just to
		// reject it after the fact. Servers don't always set this header
		// (HEAD-only metadata, transfer-encoding: chunked); when missing we
		// still cap on the actual buffer size below.
		const cl = parseInt(res.headers.get('content-length') ?? '0', 10);
		if (cl > GEMINI_MAX_IMAGE_BYTES) {
			console.warn(
				`[api/providers/gemini] Image ${cl} bytes exceeds Gemini inline limit (${GEMINI_MAX_IMAGE_BYTES}); skipping`
			);
			return [];
		}
		const buf = await res.arrayBuffer();
		if (buf.byteLength > GEMINI_MAX_IMAGE_BYTES) {
			console.warn(
				`[api/providers/gemini] Image actual size ${buf.byteLength} exceeds limit; skipping`
			);
			return [];
		}
		const data = Buffer.from(buf).toString('base64');
		const mimeType =
			(res.headers.get('content-type') ?? '').split(';')[0].trim() || 'image/png';
		return [{ inline_data: { mime_type: mimeType, data } }];
	} catch (err) {
		console.warn('[api/providers/gemini] Image fetch failed:', err);
		return [];
	}
}

async function buildParts(content: string | LLMContentBlock[]): Promise<Part[]> {
	if (typeof content === 'string') return [{ text: content }];
	const out: Part[] = [];
	for (const block of content) {
		const parts = await blockToParts(block);
		out.push(...parts);
	}
	// Gemini rejects empty parts arrays — fall back to an empty text part if
	// every block was an image and they all failed.
	return out.length > 0 ? out : [{ text: '' }];
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) {
		return json({ error: 'Gemini API key not configured' }, { status: 500 });
	}

	const body = await request.json();

	type Msg = { role: string; content: string | LLMContentBlock[] };
	const allMessages = body.messages as Msg[];
	const systemMsg = allMessages.find((m) => m.role === 'system');
	const nonSystemMessages = allMessages.filter((m) => m.role !== 'system');

	// Convert OpenAI-style messages to Gemini contents. Async because the
	// image_url → inline_data path fetches each URL server-side and
	// base64-encodes the bytes.
	const contents = await Promise.all(
		nonSystemMessages.map(async (msg) => ({
			role: msg.role === 'assistant' ? 'model' : 'user',
			parts: await buildParts(msg.content),
		}))
	);

	const geminiBody: Record<string, unknown> = { contents };
	if (systemMsg) {
		geminiBody.systemInstruction = { parts: [{ text: extractText(systemMsg.content) }] };
	}
	if (body.thinking) {
		// Map effort to a thinking-budget token count. The numbers are
		// chosen as ~1× / 8× / 24× scaling — enough variance to feel
		// different without blowing the model's max budget.
		const budget =
			body.effort === 'low' ? 1024 : body.effort === 'high' ? 24576 : 8192;
		geminiBody.generationConfig = {
			thinkingConfig: { thinkingBudget: budget },
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
