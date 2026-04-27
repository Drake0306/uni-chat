// Server-side cache + fetcher for Artificial Analysis benchmark data.
//
// AA's free tier returns the entire LLM dataset in one call. We fetch
// once, cache in module memory for 24 hours, then serve per-model
// lookups from cache. Single-flight refresh prevents thundering-herd
// upstream requests.
//
// Response shape (from AA's API reference):
//   {
//     status: 200,
//     data: [
//       {
//         id: string,            // stable unique id
//         name: string,          // human-readable, may change
//         slug: string,          // URL slug — what /models/<slug> uses
//         model_creator: { id, name, slug },
//         evaluations: {
//           artificial_analysis_intelligence_index: number,  // 0-100
//           artificial_analysis_coding_index: number,        // 0-100
//           artificial_analysis_math_index: number,          // 0-100
//           mmlu_pro: number,        // 0-1
//           gpqa: number,            // 0-1
//           scicode: number,         // 0-1
//           livecodebench: number,   // 0-1
//           math_500: number,        // 0-1
//           aime: number,            // 0-1
//           ...
//         },
//         ...other fields
//       },
//       ...
//     ]
//   }
//
// We normalize all sub-benchmark values to 0-100 percentages on the server
// so the UI just renders numbers. Indices stay 0-100 untouched.
//
// Attribution: per AA's TOS, we link "via Artificial Analysis" on every
// page that displays this data.

import { env } from '$env/dynamic/private';

export type ModelBenchmarks = {
	intelligenceIndex?: number; // 0-100
	codingIndex?: number; // 0-100
	mathIndex?: number; // 0-100
	mmluPro?: number; // 0-100 (converted from 0-1)
	gpqa?: number;
	scicode?: number;
	livecodebench?: number;
	math500?: number;
	aime?: number;
};

type AAEvaluations = {
	artificial_analysis_intelligence_index?: number;
	artificial_analysis_coding_index?: number;
	artificial_analysis_math_index?: number;
	mmlu_pro?: number;
	gpqa?: number;
	scicode?: number;
	livecodebench?: number;
	math_500?: number;
	aime?: number;
};

type AAModel = {
	id?: string;
	name?: string;
	slug?: string;
	evaluations?: AAEvaluations;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const ENDPOINT = 'https://artificialanalysis.ai/api/v2/data/llms/models';

// Index by multiple keys per model so lookups can fall through.
type Cache = {
	fetchedAt: number;
	bySlug: Map<string, AAModel>;
	byId: Map<string, AAModel>;
	byName: Map<string, AAModel>;
};

let cache: Cache | null = null;
let inFlight: Promise<void> | null = null;

function emptyCache(): Cache {
	return {
		fetchedAt: Date.now(),
		bySlug: new Map(),
		byId: new Map(),
		byName: new Map(),
	};
}

async function refresh(): Promise<void> {
	const apiKey = env.ARTIFICIAL_ANALYSIS_API_KEY;
	if (!apiKey) {
		// No key — leave cache empty so all lookups return null. Detail
		// page renders "Benchmark data not available" gracefully.
		console.info('[benchmarks] ARTIFICIAL_ANALYSIS_API_KEY not set; benchmarks disabled.');
		cache = emptyCache();
		return;
	}

	let res: Response;
	try {
		res = await fetch(ENDPOINT, { headers: { 'x-api-key': apiKey } });
	} catch (err) {
		console.warn('[benchmarks] AA fetch threw:', err);
		if (!cache) cache = emptyCache();
		return;
	}

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		console.warn('[benchmarks] AA fetch failed:', res.status, body.slice(0, 200));
		if (!cache) cache = emptyCache();
		return;
	}

	let json: unknown;
	try {
		json = await res.json();
	} catch (err) {
		console.warn('[benchmarks] AA returned non-JSON:', err);
		if (!cache) cache = emptyCache();
		return;
	}

	const wrapped = json as { data?: AAModel[] };
	const models: AAModel[] = Array.isArray(json)
		? (json as AAModel[])
		: (wrapped.data ?? []);

	const next = emptyCache();
	for (const m of models) {
		if (m.slug) next.bySlug.set(m.slug, m);
		if (m.id) next.byId.set(m.id, m);
		if (m.name) next.byName.set(m.name.toLowerCase(), m);
	}
	cache = next;
	console.info(`[benchmarks] AA cache refreshed: ${models.length} models indexed.`);
}

async function ensureFresh(): Promise<void> {
	const stale = !cache || Date.now() - cache.fetchedAt > TTL_MS;
	if (!stale) return;
	if (inFlight) return inFlight;
	inFlight = refresh().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

// Convert a 0-1 fraction to 0-100. Pass through values already on 0-100.
// Heuristic: if value > 1.5, treat as already 0-100; else multiply.
function pct(v: number | undefined): number | undefined {
	if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
	return v > 1.5 ? v : v * 100;
}

function pick(m: AAModel | undefined): ModelBenchmarks | null {
	if (!m?.evaluations) return null;
	const e = m.evaluations;
	const out: ModelBenchmarks = {
		intelligenceIndex: e.artificial_analysis_intelligence_index,
		codingIndex: e.artificial_analysis_coding_index,
		mathIndex: e.artificial_analysis_math_index,
		mmluPro: pct(e.mmlu_pro),
		gpqa: pct(e.gpqa),
		scicode: pct(e.scicode),
		livecodebench: pct(e.livecodebench),
		math500: pct(e.math_500),
		aime: pct(e.aime),
	};
	const hasAny = Object.values(out).some((v) => typeof v === 'number');
	return hasAny ? out : null;
}

/**
 * Look up benchmarks for a given Artificial Analysis slug.
 * Falls through to id and name (case-insensitive) lookups so a slightly
 * wrong aaSlug in models.ts can still surface data when the name matches.
 * Returns null if no match, no key, or AA doesn't track this model.
 */
export async function getBenchmarks(slug: string | undefined): Promise<ModelBenchmarks | null> {
	if (!slug) return null;
	await ensureFresh();
	if (!cache) return null;
	const m =
		cache.bySlug.get(slug) ??
		cache.byId.get(slug) ??
		cache.byName.get(slug.toLowerCase());
	const result = pick(m);
	if (!result) {
		console.info(`[benchmarks] no match for slug "${slug}" (cache size: ${cache.bySlug.size})`);
	}
	return result;
}
