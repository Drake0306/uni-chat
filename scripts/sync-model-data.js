#!/usr/bin/env node
// Pulls model metadata from models.dev (https://models.dev/api.json) and
// writes augmentation entries for any model in src/lib/config/models.ts
// that has a `modelsDevId` set.
//
// Output: src/lib/config/models-augmentation.generated.ts (committed).
// At runtime, src/lib/config/models.ts merges this onto each Model so
// the editorial fields stay yours but factual fields auto-update.
//
// Run via `npm run sync-models`. Re-run whenever you add a new model
// or want to refresh context windows / pricing / knowledge cutoffs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MODELS_TS = 'src/lib/config/models.ts';
const OUT_FILE = 'src/lib/config/models-augmentation.generated.ts';
const API = 'https://models.dev/api.json';

// ─── 1. Extract { ourId → modelsDevId } pairs from models.ts ─────────
// Each model in models.ts is one line. We scan line-by-line for any line
// that has both an `id:` and a `modelsDevId:` and take the pair. This
// avoids regex pitfalls with nested braces like `capabilities: caps({...})`.
function extractMapping(text) {
	const mapping = new Map();
	const idRe = /\bid:\s*['"]([^'"]+)['"]/;
	const devRe = /\bmodelsDevId:\s*['"]([^'"]+)['"]/;
	for (const line of text.split('\n')) {
		const idMatch = idRe.exec(line);
		const devMatch = devRe.exec(line);
		if (idMatch && devMatch) {
			mapping.set(idMatch[1], devMatch[1]);
		}
	}
	return mapping;
}

// ─── 2. Format helpers ──────────────────────────────────────────────
function formatContext(tokens) {
	if (typeof tokens !== 'number' || !tokens) return undefined;
	if (tokens >= 1_000_000) {
		const m = tokens / 1_000_000;
		const s = m === Math.floor(m) ? `${m}` : m.toFixed(1).replace(/\.0$/, '');
		return `${s}M`;
	}
	return `${Math.round(tokens / 1000)}K`;
}

function formatKnowledge(s) {
	if (!s) return undefined;
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
	return undefined;
}

// ─── 3. Main ────────────────────────────────────────────────────────
async function main() {
	const text = readFileSync(MODELS_TS, 'utf8');
	const mapping = extractMapping(text);
	console.log(`Extracted ${mapping.size} modelsDevId mappings from ${MODELS_TS}.`);

	if (mapping.size === 0) {
		console.warn('\nNo modelsDevId fields found. Add them in models.ts and re-run.');
		writeFileSync(OUT_FILE, emptyAugmentationFile());
		return;
	}

	console.log(`Fetching ${API} ...`);
	const res = await fetch(API);
	if (!res.ok) {
		console.error(`Failed: HTTP ${res.status}`);
		process.exit(1);
	}
	const json = await res.json();

	// Flatten all providers' models into a single map keyed by model id.
	// Shape: { providerId: { models: { modelId: {...}, ... }, ... } }
	//
	// The same model id often appears under several providers (canonical
	// provider + aggregators like openrouter, nano-gpt, etc.) with subtly
	// different capability flags. We process providers in priority order so
	// the canonical maker's data wins when there's a conflict.
	const PROVIDER_PRIORITY = [
		'anthropic', 'openai', 'google', 'xai', 'deepseek', 'moonshotai',
		'mistral', 'cohere', 'meta-llama', 'qwen', 'alibaba-cn', 'amazon-bedrock',
		'groq', 'openrouter', 'fireworks-ai', 'togetherai',
	];
	const providerEntries = Object.entries(json);
	providerEntries.sort(([a], [b]) => {
		const ai = PROVIDER_PRIORITY.indexOf(a);
		const bi = PROVIDER_PRIORITY.indexOf(b);
		if (ai === -1 && bi === -1) return 0;
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	const allModels = new Map();
	for (const [, provider] of providerEntries) {
		if (!provider || typeof provider !== 'object' || !provider.models) continue;
		for (const [id, m] of Object.entries(provider.models)) {
			if (!allModels.has(id)) {
				allModels.set(id, { ...m, _providerName: provider.name ?? provider.id });
			}
		}
	}
	console.log(`models.dev has ${allModels.size} unique model ids across providers.`);

	const aug = {};
	const missing = [];
	for (const [ourId, devId] of mapping) {
		const found = allModels.get(devId);
		if (!found) {
			missing.push({ ourId, devId });
			continue;
		}
		const entry = {};
		const ctx = formatContext(found.limit?.context);
		if (ctx) entry.contextWindow = ctx;
		const knowledge = formatKnowledge(found.knowledge);
		if (knowledge) entry.knowledgeCutoff = knowledge;
		if (typeof found.cost?.input === 'number') entry.costInputUsdPerMillion = found.cost.input;
		if (typeof found.cost?.output === 'number') entry.costOutputUsdPerMillion = found.cost.output;
		if (found.release_date) entry.modelsDevReleaseDate = found.release_date;
		if (found.last_updated) entry.modelsDevLastUpdated = found.last_updated;
		entry.modelsDevSourceProvider = found._providerName;

		// Translate models.dev's capability schema to ours. The merger in
		// models.ts spreads this onto model.capabilities at module load,
		// so the rest of the codebase keeps using the same field names.
		// Mapping:
		//   reasoning  → thinking
		//   tool_call  → tools
		//   attachment → files
		//   modalities.input contains "image" → vision
		// webSearch and imageGeneration are NOT in models.dev — stay hardcoded.
		const caps = {};
		if (typeof found.reasoning === 'boolean') caps.thinking = found.reasoning;
		if (typeof found.tool_call === 'boolean') caps.tools = found.tool_call;
		if (typeof found.attachment === 'boolean') caps.files = found.attachment;
		if (Array.isArray(found.modalities?.input)) {
			caps.vision = found.modalities.input.includes('image');
		}
		if (Object.keys(caps).length > 0) entry.capabilities = caps;

		aug[ourId] = entry;
	}

	mkdirSync(dirname(OUT_FILE), { recursive: true });
	writeFileSync(OUT_FILE, render(aug));

	console.log(`\nWrote ${Object.keys(aug).length} augmentation entries to ${OUT_FILE}.`);
	if (missing.length) {
		console.warn(`\n${missing.length} mappings did not resolve on models.dev:`);
		for (const { ourId, devId } of missing) {
			console.warn(`  ${ourId.padEnd(28)} modelsDevId="${devId}"`);
		}
		console.warn('\nFix the modelsDevId in models.ts (or remove it if models.dev does not track it) and re-run.');
	}
}

function emptyAugmentationFile() {
	return render({});
}

function render(aug) {
	const banner = [
		'// AUTO-GENERATED — DO NOT EDIT BY HAND.',
		'// Run `npm run sync-models` to regenerate.',
		'// Source: https://models.dev/api.json (MIT). Per-field merger lives at the',
		'// bottom of src/lib/config/models.ts.',
		'',
	].join('\n');
	const types = `export type ModelAugmentation = {
	contextWindow?: string;
	knowledgeCutoff?: string;
	/** Subset of ModelCapabilities — only fields models.dev tracks. */
	capabilities?: { thinking?: boolean; tools?: boolean; files?: boolean; vision?: boolean };
	costInputUsdPerMillion?: number;
	costOutputUsdPerMillion?: number;
	modelsDevReleaseDate?: string;
	modelsDevLastUpdated?: string;
	modelsDevSourceProvider?: string;
};
`;
	const body = `export const augmentation: Record<string, ModelAugmentation> = ${JSON.stringify(aug, null, '\t')};\n`;
	return `${banner}\n${types}\n${body}`;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
