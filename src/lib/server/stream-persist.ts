import { getServiceClient } from './supabase.js';

/**
 * Parse raw SSE text and extract concatenated content and reasoning strings.
 * Expects OpenAI-compatible SSE format:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: {"choices":[{"delta":{"reasoning_content":"..."}}]}
 *   data: [DONE]
 */
export function parseSSE(raw: string): { content: string; reasoning: string } {
	let content = '';
	let reasoning = '';

	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('data: ')) continue;

		const payload = trimmed.slice(6);
		if (payload === '[DONE]') break;

		try {
			const json = JSON.parse(payload);
			const delta = json?.choices?.[0]?.delta;
			if (!delta) continue;

			if (typeof delta.content === 'string') {
				content += delta.content;
			}
			if (typeof delta.reasoning_content === 'string') {
				reasoning += delta.reasoning_content;
			}
		} catch {
			// Skip malformed JSON lines
		}
	}

	return { content, reasoning };
}

/**
 * Read a response stream to completion, parse the accumulated SSE data,
 * and upsert the assistant message into the messages table.
 *
 * This function NEVER throws — all errors are caught and logged.
 * Designed to be called fire-and-forget alongside streaming to the client.
 */
export async function accumulateAndSave(
	stream: ReadableStream<Uint8Array>,
	chatId: string,
	messageId: string,
	modelName?: string
): Promise<void> {
	console.log('[stream-persist] START accumulating for chat:', chatId, 'msg:', messageId);
	try {
		// Create the assistant message row immediately (empty content).
		// This lets the client show a loading indicator if the user reloads mid-stream.
		await getServiceClient()
			.from('messages')
			.upsert({
				id: messageId,
				chat_id: chatId,
				role: 'assistant',
				content: '',
				model_name: modelName ?? null,
				is_error: false,
			});

		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let raw = '';

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			raw += decoder.decode(value, { stream: true });
		}

		// Flush any remaining bytes in the decoder
		raw += decoder.decode();

		console.log('[stream-persist] Stream complete, raw length:', raw.length);

		const { content, reasoning } = parseSSE(raw);

		console.log('[stream-persist] Parsed — content length:', content.length, 'reasoning length:', reasoning.length);

		// Skip save if there's nothing to persist
		if (!content && !reasoning) {
			console.log('[stream-persist] Nothing to save, skipping');
			return;
		}

		const { error } = await getServiceClient()
			.from('messages')
			.upsert({
				id: messageId,
				chat_id: chatId,
				role: 'assistant',
				content,
				reasoning: reasoning || null,
				model_name: modelName ?? null,
				is_error: !content,
			});

		if (error) {
			console.error('[stream-persist] Supabase upsert FAILED:', error.message, error);
		} else {
			console.log('[stream-persist] SAVED successfully, content length:', content.length);
		}
	} catch (err) {
		console.error('[stream-persist] accumulateAndSave error:', err);
	}
}
