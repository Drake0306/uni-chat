// Streaming-safe extractor for inline <think>...</think> tags.
//
// Some providers (notably Groq when reasoning_format defaults to 'raw',
// and certain upstream models on OpenRouter) emit chain-of-thought as
// `<think>…</think>` inside delta.content instead of populating the
// separate `reasoning` field. We strip them here so the UI can route
// them to the dedicated thinking block consistently across providers.
//
// Stateful — handles chunks that split a tag mid-token (e.g. one chunk
// ends `<th` and the next starts `ink>`). Use one instance per stream;
// call flush() once the stream ends to release any buffered partial tag.

const OPEN = '<think>';
const CLOSE = '</think>';

export class ThinkTagStripper {
	private inThink = false;
	private buffer = '';

	process(chunk: string): { content: string; reasoning: string } {
		let content = '';
		let reasoning = '';
		let work = this.buffer + chunk;
		this.buffer = '';

		while (work.length > 0) {
			if (this.inThink) {
				const idx = work.indexOf(CLOSE);
				if (idx >= 0) {
					reasoning += work.slice(0, idx);
					work = work.slice(idx + CLOSE.length);
					this.inThink = false;
				} else {
					// Hold trailing prefix of CLOSE for the next chunk.
					const partial = trailingPrefixLen(work, CLOSE);
					reasoning += work.slice(0, work.length - partial);
					this.buffer = work.slice(work.length - partial);
					work = '';
				}
			} else {
				const idx = work.indexOf(OPEN);
				if (idx >= 0) {
					content += work.slice(0, idx);
					work = work.slice(idx + OPEN.length);
					this.inThink = true;
				} else {
					const partial = trailingPrefixLen(work, OPEN);
					content += work.slice(0, work.length - partial);
					this.buffer = work.slice(work.length - partial);
					work = '';
				}
			}
		}

		return { content, reasoning };
	}

	// Releases the held buffer once the stream ends. If we were mid-think
	// (no closing tag ever arrived) the buffer is dropped — better than
	// dumping a half-tagged thought into the message body.
	flush(): { content: string; reasoning: string } {
		if (this.buffer.length === 0) return { content: '', reasoning: '' };
		const out =
			this.inThink || /^<\/?t/i.test(this.buffer)
				? { content: '', reasoning: '' }
				: { content: this.buffer, reasoning: '' };
		this.buffer = '';
		return out;
	}
}

// Returns N where buffer's last N chars match a prefix of needle (excluding
// a full match — that's handled by indexOf above). Used to detect whether
// a tag has begun at the tail of the chunk and we need to wait for more.
function trailingPrefixLen(buffer: string, needle: string): number {
	const max = Math.min(needle.length - 1, buffer.length);
	for (let n = max; n > 0; n--) {
		if (needle.startsWith(buffer.slice(buffer.length - n))) return n;
	}
	return 0;
}
