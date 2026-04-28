// Split a string into segments around case-insensitive matches of `query`.
// Used by the command palette to render matched substrings in a stronger
// weight while keeping the surrounding text muted, without resorting to
// dangerouslySetInnerHTML / @html.
//
// Example:
//   splitMatch('React perf debugging', 'perf')
//   → [
//       { text: 'React ', match: false },
//       { text: 'perf', match: true },
//       { text: ' debugging', match: false },
//     ]
//
// Returns the original text as a single non-match segment when query is
// empty or has no matches.

export interface Segment {
	text: string;
	match: boolean;
}

export function splitMatch(text: string, query: string): Segment[] {
	const q = query.trim();
	if (!q) return [{ text, match: false }];

	const lowerText = text.toLowerCase();
	const lowerQuery = q.toLowerCase();
	const idx = lowerText.indexOf(lowerQuery);
	if (idx < 0) return [{ text, match: false }];

	// Single-match split. Multi-match would need a loop, but for the palette
	// (short titles, a single search term) one match is the common case and
	// further matches add visual noise.
	const segments: Segment[] = [];
	if (idx > 0) segments.push({ text: text.slice(0, idx), match: false });
	segments.push({ text: text.slice(idx, idx + q.length), match: true });
	if (idx + q.length < text.length) {
		segments.push({ text: text.slice(idx + q.length), match: false });
	}
	return segments;
}
