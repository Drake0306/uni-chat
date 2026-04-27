// Server-side web search via Tavily (https://tavily.com).
//
// Why Tavily: AI-native, citation-ready snippets, 1k free searches per
// month. See docs/web-search.md for the full backend comparison and
// architectural rationale.
//
// Server-only — TAVILY_API_KEY never reaches the browser. The Search
// toggle in the chat composer triggers an injection in /api/chat
// before the provider call.

import { env } from '$env/dynamic/private';

export type WebSearchResult = {
	title: string;
	url: string;
	content: string;
};

const ENDPOINT = 'https://api.tavily.com/search';

/**
 * Run a Tavily search. Returns up to `maxResults` results, or null when
 * the API key is missing, the request fails, or no results come back.
 * Failures are logged but never thrown — search is best-effort, the
 * model still gets to answer without it.
 */
export async function searchWeb(
	query: string,
	opts: { maxResults?: number } = {}
): Promise<WebSearchResult[] | null> {
	const apiKey = env.TAVILY_API_KEY;
	if (!apiKey) {
		console.info('[web-search] TAVILY_API_KEY not set; skipping search.');
		return null;
	}
	const cleaned = query.trim();
	if (!cleaned) return null;

	let res: Response;
	try {
		res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				api_key: apiKey,
				query: cleaned,
				search_depth: 'basic',
				max_results: opts.maxResults ?? 5,
				include_answer: false,
			}),
		});
	} catch (err) {
		console.warn('[web-search] tavily fetch threw:', err);
		return null;
	}

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		console.warn('[web-search] tavily failed:', res.status, body.slice(0, 200));
		return null;
	}

	let json: unknown;
	try {
		json = await res.json();
	} catch (err) {
		console.warn('[web-search] tavily returned non-JSON:', err);
		return null;
	}

	const data = json as { results?: WebSearchResult[] };
	const results = (data.results ?? []).filter(
		(r) => r && typeof r.title === 'string' && typeof r.url === 'string' && typeof r.content === 'string'
	);
	return results.length > 0 ? results : null;
}

/**
 * Format Tavily results as an inline context block to prepend to the
 * user's most recent message. Plain text — works across every provider's
 * message format. The original user question is repeated at the bottom
 * so the model treats the search results as context, not the prompt.
 */
export function formatSearchContext(results: WebSearchResult[], originalQuery: string): string {
	const lines: string[] = [];
	lines.push(`[Web search results for: "${originalQuery}"]`);
	lines.push('');
	results.forEach((r, i) => {
		lines.push(`${i + 1}. ${r.title}`);
		lines.push(`   ${r.url}`);
		lines.push(`   ${r.content.replace(/\s+/g, ' ').slice(0, 800)}`);
		lines.push('');
	});
	lines.push('[End of web search results. Cite source URLs in your answer where relevant.]');
	lines.push('');
	lines.push(`User's question: ${originalQuery}`);
	return lines.join('\n');
}
