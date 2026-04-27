/**
 * Centralized model & provider configuration.
 * Single source of truth for the entire app.
 *
 * IMPORTANT: "Company" = what the user sees (Google, Meta, Anthropic...).
 * "Route" = internal plumbing (which API endpoint to hit). The user never sees routes.
 *
 * To enable/disable a company or model, flip the `enabled` flag.
 * To mark something as paid, set `free: false`.
 */

export function iconUrl(name: string) {
	return `/icons/${name}.svg`;
}

// ─── Types ───────────────────────────────────────────────────────────

export type ModelCapabilities = {
	thinking: boolean;
	vision: boolean;
	tools: boolean;
	webSearch: boolean;
	files: boolean;
	imageGeneration: boolean;
};

export function capabilityLabels(caps: ModelCapabilities, contextWindow: string): string[] {
	const labels: string[] = [];
	if (caps.thinking) labels.push('Thinking');
	if (caps.vision) labels.push('Vision');
	if (caps.tools) labels.push('Tools');
	if (caps.webSearch) labels.push('Search');
	if (caps.files) labels.push('Files');
	if (caps.imageGeneration) labels.push('Image Gen');
	labels.push(`${contextWindow} ctx`);
	return labels;
}

const NO_CAPS: ModelCapabilities = { thinking: false, vision: false, tools: false, webSearch: false, files: false, imageGeneration: false };
const caps = (overrides: Partial<ModelCapabilities> = {}): ModelCapabilities => ({ ...NO_CAPS, ...overrides });

/**
 * Inference provider — the underlying service that runs the model.
 * Distinct from the model's "company" (the org that made the model).
 * Surfaced to the user in the model selector via PROVIDERS[model.provider].
 */
export type Provider =
	| 'gemini'
	| 'openrouter'
	| 'groq'
	| 'mistral'
	| 'anthropic'
	| 'openai'
	| 'xai'
	| 'deepseek'
	| 'moonshot'
	| 'cohere'
	| 'perplexity'
	| 'qwen';

export const PROVIDERS: Record<Provider, { name: string; icon: string }> = {
	gemini: { name: 'Google', icon: 'gemini-color' },
	openrouter: { name: 'OpenRouter', icon: 'openrouter' },
	groq: { name: 'Groq', icon: 'groq' },
	mistral: { name: 'Mistral', icon: 'mistral-color' },
	anthropic: { name: 'Anthropic', icon: 'anthropic' },
	openai: { name: 'OpenAI', icon: 'openai' },
	xai: { name: 'xAI', icon: 'grok' },
	deepseek: { name: 'DeepSeek', icon: 'deepseek-color' },
	moonshot: { name: 'Moonshot', icon: 'moonshot' },
	cohere: { name: 'Cohere', icon: 'cohere-color' },
	perplexity: { name: 'Perplexity', icon: 'perplexity-color' },
	qwen: { name: 'Qwen', icon: 'qwen-color' },
};

export type Model = {
	id: string;
	name: string;
	icon: string;
	capabilities: ModelCapabilities;
	contextWindow: string;
	free: boolean;
	enabled: boolean;
	isNew?: boolean;
	/** Short marketing-style line shown in the Models settings tab. */
	description?: string;
	/** Multi-sentence description shown on the model detail page. */
	longDescription?: string;
	/** Symbol-based price tier. Only set on paid models (free=false); free models render the FREE badge instead. */
	priceTier?: '$' | '$$' | '$$$' | '$$$$';
	/** Bring-your-own-key model — user must supply their own API key. Visual only until the API Keys tab is wired. */
	byok?: boolean;
	/** Org that built the model. Distinct from `provider` (the inference host). E.g., "Llama 4 via Groq" → developer="Meta", provider="groq". */
	developer?: string;
	/** ISO YYYY-MM-DD knowledge cutoff date as published by the model maker. */
	knowledgeCutoff?: string;
	/** ISO YYYY-MM-DD date the model was added to chatCD. */
	addedOn?: string;
	/** Slug used to look up benchmark data via Artificial Analysis. Leave undefined if AA doesn't track this model. */
	aaSlug?: string;
	/** Model ID on models.dev (https://models.dev/api.json). Used by `npm run sync-models` to pull factual augmentation data (context window, knowledge cutoff, pricing). Leave undefined if not tracked. */
	modelsDevId?: string;
	/** Inference provider serving this model — shown to user as a small chip */
	provider: Provider;
	/** Internal: which API route handles this model */
	route: string;
	/** Internal: the model ID to send to the provider API */
	apiModelId: string;
};

// ─── Recommended-by-default subset ───────────────────────────────────
// Used as the user's starred set when no Supabase row exists for them
// (new users, guests). Picked to cover fast/multimodal/reasoning across
// 3+ providers. Edit freely; chunk 2 hydrates against this list.
export const DEFAULT_RECOMMENDED: ReadonlySet<string> = new Set([
	'gemini-2.5-flash',
	'gemini-2.5-pro',
	'gpt-oss-120b',
	'meta-llama-4-scout-fast',
	'deepseek-r1-free',
]);

/** What the user sees in the sidebar — a parent company */
export type Company = {
	id: string;
	name: string;
	icon: string;
	models: Model[];
};

// ─── Route endpoints (internal, never shown to user) ─────────────────

const ROUTES = {
	gemini: '/api/providers/gemini',
	openrouter: '/api/providers/openrouter',
	groq: '/api/providers/groq',
	mistral: '/api/providers/mistral',
	anthropic: '/api/providers/anthropic',
	openai: '/api/providers/openai',
	xai: '/api/providers/xai',
	deepseek: '/api/providers/deepseek',
	moonshot: '/api/providers/moonshot',
	cohere: '/api/providers/cohere',
	perplexity: '/api/providers/perplexity',
	qwen: '/api/providers/qwen',
} as const;

// ─── Companies (user-facing) ─────────────────────────────────────────

export const companies: Company[] = [
	{
		id: 'google',
		name: 'Google',
		icon: 'gemini-color',
		models: [
			{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: 'gemini-color', capabilities: caps({ vision: true }), contextWindow: '1M', free: true, enabled: true, isNew: true, description: "Google's fast, affordable multimodal workhorse", longDescription: 'Gemini 2.5 Flash is the everyday workhorse of the Gemini family — multimodal, fast, and priced for high-volume use. It accepts text and image inputs and handles a million-token context window without tipping into Pro pricing.', developer: 'Google', knowledgeCutoff: '2025-01-01', addedOn: '2025-04-15', aaSlug: 'gemini-2-5-flash', modelsDevId: 'gemini-2.5-flash', provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-flash' },
			{ id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', icon: 'gemini-color', capabilities: caps(), contextWindow: '1M', free: true, enabled: true, description: 'Cheapest Google model for high-volume tasks', longDescription: 'Flash-Lite is the smallest, cheapest Gemini variant — good for classification, simple chat, and bulk text tasks where token cost matters more than reasoning depth.', developer: 'Google', knowledgeCutoff: '2025-01-01', addedOn: '2025-04-15', aaSlug: 'gemini-2-5-flash-lite', modelsDevId: 'gemini-2.5-flash-lite', provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-flash-lite' },
			{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: 'gemini-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '1M', free: true, enabled: true, isNew: true, description: "Google's flagship thinking model with vision", longDescription: "Gemini 2.5 Pro is Google's flagship reasoning model. Native thinking, multimodal input, and a million-token context window make it well-suited for long documents, codebases, and tasks that benefit from reflection.", developer: 'Google', knowledgeCutoff: '2025-01-01', addedOn: '2025-04-15', aaSlug: 'gemini-2-5-pro', modelsDevId: 'gemini-2.5-pro', provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-pro' },
		],
	},
	{
		id: 'meta',
		name: 'Meta',
		icon: 'meta-color',
		models: [
			{ id: 'meta-llama-3.3-70b', name: 'Llama 3.3 70B', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, description: "Meta's open-weights flagship via OpenRouter", longDescription: "Llama 3.3 70B is Meta's open-weights workhorse — strong general intelligence, instruction-following, and code, served via OpenRouter's free tier.", developer: 'Meta', knowledgeCutoff: '2024-12-01', addedOn: '2025-02-10', aaSlug: 'llama-3-3-instruct-70b', modelsDevId: 'llama-3.3-70b-instruct', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-3.3-70b-instruct:free' },
			{ id: 'meta-llama-3.3-70b-fast', name: 'Llama 3.3 70B (Fast)', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, description: 'Llama 3.3 70B served at Groq speeds', longDescription: 'Same Llama 3.3 70B model as the OpenRouter version, but served by Groq for very low latency. Use this when responsiveness matters more than provider diversity.', developer: 'Meta', knowledgeCutoff: '2024-12-01', addedOn: '2025-02-10', aaSlug: 'llama-3-3-instruct-70b', modelsDevId: 'llama-3.3-70b-versatile', provider: 'groq', route: ROUTES.groq, apiModelId: 'llama-3.3-70b-versatile' },
			{ id: 'meta-llama-3.1-8b', name: 'Llama 3.1 8B (Instant)', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, description: 'Tiny, instant Llama for quick replies', longDescription: "Meta's smallest current Llama, hosted on Groq. Best for snappy short replies, classification, and lightweight chat where token-cost-per-task is paramount.", developer: 'Meta', knowledgeCutoff: '2024-07-01', addedOn: '2025-01-15', aaSlug: 'llama-3-1-instruct-8b', modelsDevId: 'llama-3.1-8b-instant', provider: 'groq', route: ROUTES.groq, apiModelId: 'llama-3.1-8b-instant' },
			// Groq preview — for evaluation only, may be removed without notice
			{ id: 'meta-llama-4-scout-fast', name: 'Llama 4 Scout (Fast)', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, description: 'Llama 4 Scout — long context with vision', longDescription: 'The smaller of the Llama 4 series, hosted on Groq for low-latency multimodal chat. Note: Groq treats this as preview and may pull it without notice.', developer: 'Meta', knowledgeCutoff: '2025-03-01', addedOn: '2025-04-20', aaSlug: 'llama-4-scout', modelsDevId: 'meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq', route: ROUTES.groq, apiModelId: 'meta-llama/llama-4-scout-17b-16e-instruct' },
			{ id: 'meta-llama-4-maverick', name: 'Llama 4 Maverick', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '1M', free: false, enabled: false, isNew: true, description: "Meta's premium MoE flagship", longDescription: "The largest of Meta's Llama 4 lineup — a sparse mixture-of-experts model designed to compete with the frontier closed-source options on reasoning and coding.", developer: 'Meta', knowledgeCutoff: '2025-03-01', addedOn: '2025-04-20', aaSlug: 'llama-4-maverick', modelsDevId: 'llama-4-maverick', priceTier: '$$$', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-4-maverick' },
			{ id: 'meta-llama-4-scout', name: 'Llama 4 Scout', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '10M', free: false, enabled: false, isNew: true, description: 'Llama 4 Scout with 10M-token context', longDescription: "Llama 4 Scout's claim to fame is the 10M-token context window — useful for very long documents, codebases, and chat histories. The OpenRouter paid route, in contrast to Groq's preview.", developer: 'Meta', knowledgeCutoff: '2025-03-01', addedOn: '2025-04-20', aaSlug: 'llama-4-scout', modelsDevId: 'llama-4-scout', priceTier: '$$', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-4-scout' },
		],
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		icon: 'anthropic',
		models: [
			{ id: 'claude-opus-4', name: 'Claude Opus 4', icon: 'claude-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, description: "Anthropic's most capable thinking model", longDescription: "Claude Opus 4 is Anthropic's flagship — top-end reasoning, agentic capability, and the strongest at long-form coding and writing. Pricier than Sonnet; reserve for tasks where Sonnet is hitting limits.", developer: 'Anthropic', knowledgeCutoff: '2025-03-01', addedOn: '2025-05-22', aaSlug: 'claude-4-opus', modelsDevId: 'claude-opus-4', priceTier: '$$$$', provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-opus-4' },
			{ id: 'claude-sonnet-4', name: 'Claude Sonnet 4', icon: 'claude-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, description: "Anthropic's balanced thinking model", longDescription: "Claude Sonnet 4 hits the sweet spot of capability and efficiency — significantly more capable than the 3.x series, but fast enough for everyday use. The default choice for developers who need reliable, intelligent assistance without the premium cost of Opus.", developer: 'Anthropic', knowledgeCutoff: '2025-03-01', addedOn: '2025-05-22', aaSlug: 'claude-4-sonnet', modelsDevId: 'claude-sonnet-4', priceTier: '$$$', provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-sonnet-4' },
			{ id: 'claude-haiku-3.5', name: 'Claude Haiku 3.5', icon: 'claude-color', capabilities: caps({ vision: true }), contextWindow: '200K', free: false, enabled: false, description: 'Fast, lightweight Anthropic model', longDescription: 'Claude Haiku 3.5 is the fast, low-cost member of the Claude family — quick responses with surprising depth for routing, classification, and lightweight chat.', developer: 'Anthropic', knowledgeCutoff: '2024-07-01', addedOn: '2024-12-01', aaSlug: 'claude-3-5-haiku', modelsDevId: 'claude-3-5-haiku', priceTier: '$$', provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-haiku-3.5' },
		],
	},
	{
		id: 'openai',
		name: 'OpenAI',
		icon: 'openai',
		models: [
			{ id: 'gpt-oss-120b', name: 'GPT-OSS 120B', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, description: "OpenAI's open-weights flagship at Groq speeds", longDescription: "OpenAI's open-weights 120B reasoning model, hosted on Groq for very low latency. Supports reasoning_effort low/medium/high.", developer: 'OpenAI', knowledgeCutoff: '2024-06-01', addedOn: '2025-08-15', aaSlug: 'gpt-oss-120b', modelsDevId: 'openai/gpt-oss-120b', provider: 'groq', route: ROUTES.groq, apiModelId: 'openai/gpt-oss-120b' },
			{ id: 'gpt-oss-20b', name: 'GPT-OSS 20B', icon: 'openai', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, isNew: true, description: 'Compact OpenAI open-weights model', longDescription: 'The smaller of the GPT-OSS pair — same lineage, faster and cheaper. No reasoning capability; use the 120B variant when thinking matters.', developer: 'OpenAI', knowledgeCutoff: '2024-06-01', addedOn: '2025-08-15', aaSlug: 'gpt-oss-20b', modelsDevId: 'openai/gpt-oss-20b', provider: 'groq', route: ROUTES.groq, apiModelId: 'openai/gpt-oss-20b' },
			{ id: 'gpt-4.1', name: 'GPT-4.1', icon: 'openai', capabilities: caps({ vision: true, tools: true }), contextWindow: '1M', free: false, enabled: false, isNew: true, description: "OpenAI's flagship coding and writing model", longDescription: "GPT-4.1 is OpenAI's flagship non-reasoning model — strong at long-form writing, code, and instruction-following with a million-token context window.", developer: 'OpenAI', knowledgeCutoff: '2024-06-01', addedOn: '2025-04-15', aaSlug: 'gpt-4-1', modelsDevId: 'gpt-4.1', priceTier: '$$$', provider: 'openai', route: ROUTES.openai, apiModelId: 'gpt-4.1' },
			{ id: 'gpt-4o', name: 'GPT-4o', icon: 'openai', capabilities: caps({ vision: true, tools: true }), contextWindow: '128K', free: false, enabled: false, description: "OpenAI's multimodal everyday workhorse", longDescription: "GPT-4o (omni) is OpenAI's everyday multimodal model — handles text, images, and tool-calling well. Predecessor to the 4.1 series.", developer: 'OpenAI', knowledgeCutoff: '2023-10-01', addedOn: '2024-06-01', aaSlug: 'gpt-4o', modelsDevId: 'gpt-4o', priceTier: '$$$', provider: 'openai', route: ROUTES.openai, apiModelId: 'gpt-4o' },
			{ id: 'o3', name: 'o3', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '200K', free: false, enabled: false, description: "OpenAI's flagship reasoning model", longDescription: "o3 is OpenAI's frontier reasoning model — top-tier at math, science, and complex coding tasks. Pricey, but unmatched for problems where stepwise reasoning matters.", developer: 'OpenAI', knowledgeCutoff: '2024-06-01', addedOn: '2025-04-16', aaSlug: 'o3', modelsDevId: 'o3', priceTier: '$$$$', provider: 'openai', route: ROUTES.openai, apiModelId: 'o3' },
			{ id: 'o4-mini', name: 'o4-mini', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, description: 'Lightweight OpenAI reasoning model', longDescription: 'o4-mini is the cheap reasoning option from OpenAI — substantially cheaper than o3 with most of the reasoning quality intact. The default choice for tasks that benefit from thinking but don\'t need o3-class depth.', developer: 'OpenAI', knowledgeCutoff: '2024-06-01', addedOn: '2025-04-16', aaSlug: 'o4-mini', modelsDevId: 'o4-mini', priceTier: '$$', provider: 'openai', route: ROUTES.openai, apiModelId: 'o4-mini' },
		],
	},
	{
		id: 'deepseek',
		name: 'DeepSeek',
		icon: 'deepseek-color',
		models: [
			{ id: 'deepseek-r1-free', name: 'DeepSeek R1', icon: 'deepseek-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, description: "DeepSeek's flagship open reasoning model", longDescription: "DeepSeek R1 is the open-weights reasoning model that put DeepSeek on the frontier benchmark map — strong math and code performance, generous free-tier access via OpenRouter.", developer: 'DeepSeek', knowledgeCutoff: '2024-07-01', addedOn: '2025-01-25', aaSlug: 'deepseek-r1', modelsDevId: 'deepseek-reasoner', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'deepseek/deepseek-r1:free' },
			{ id: 'deepseek-v3', name: 'DeepSeek V3', icon: 'deepseek-color', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, description: "DeepSeek's general-purpose chat model", longDescription: "DeepSeek V3 is the non-reasoning member of the DeepSeek family — a general chat model with solid coding ability at competitive pricing.", developer: 'DeepSeek', knowledgeCutoff: '2024-07-01', addedOn: '2025-01-10', aaSlug: 'deepseek-v3', modelsDevId: 'deepseek-chat', priceTier: '$', provider: 'deepseek', route: ROUTES.deepseek, apiModelId: 'deepseek-chat' },
		],
	},
	{
		id: 'mistral',
		name: 'Mistral',
		icon: 'mistral-color',
		models: [
			{ id: 'mistral-small', name: 'Mistral Small', icon: 'mistral-color', capabilities: caps({ tools: true }), contextWindow: '128K', free: true, enabled: true, description: "Mistral's nimble general-purpose model", longDescription: "Mistral Small is the everyday choice in Mistral's lineup — cheap, fast, capable enough for most chat and tool-calling tasks.", developer: 'Mistral', knowledgeCutoff: '2024-09-01', addedOn: '2025-01-15', aaSlug: 'mistral-small', modelsDevId: 'mistral-small-latest', provider: 'mistral', route: ROUTES.mistral, apiModelId: 'mistral-small-latest' },
			{ id: 'mistral-large', name: 'Mistral Large', icon: 'mistral-color', capabilities: caps({ vision: true, tools: true }), contextWindow: '128K', free: true, enabled: true, description: "Mistral's flagship multimodal model", longDescription: "Mistral Large is Mistral's flagship — multimodal input, tool calling, and the strongest reasoning of the Mistral family.", developer: 'Mistral', knowledgeCutoff: '2024-09-01', addedOn: '2025-01-15', aaSlug: 'mistral-large-2', modelsDevId: 'mistral-large-latest', provider: 'mistral', route: ROUTES.mistral, apiModelId: 'mistral-large-latest' },
			{ id: 'codestral', name: 'Codestral', icon: 'mistral-color', capabilities: caps(), contextWindow: '256K', free: true, enabled: true, description: "Mistral's specialized coding model", longDescription: "Codestral is Mistral's coding-tuned model — fluent in 80+ programming languages and specifically optimized for fill-in-the-middle code completion.", developer: 'Mistral', knowledgeCutoff: '2024-04-01', addedOn: '2024-12-01', modelsDevId: 'codestral-latest', provider: 'mistral', route: ROUTES.mistral, apiModelId: 'codestral-latest' },
		],
	},
	{
		id: 'qwen',
		name: 'Qwen',
		icon: 'qwen-color',
		models: [
			{ id: 'qwen3-coder-free', name: 'Qwen3 Coder 480B', icon: 'qwen-color', capabilities: caps(), contextWindow: '262K', free: true, enabled: true, isNew: true, description: "Alibaba's coding-tuned 480B MoE", longDescription: "Qwen3 Coder 480B is Alibaba's largest open coding model — sparse MoE architecture, 262K context window, and strong fill-in-the-middle code completion.", developer: 'Alibaba', knowledgeCutoff: '2024-12-01', addedOn: '2025-04-15', aaSlug: 'qwen3-coder-480b-a35b-instruct', modelsDevId: 'qwen3-coder-480b-a35b-instruct', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'qwen/qwen3-coder-480b:free' },
			// Groq preview — for evaluation only, may be removed without notice
			{ id: 'qwen3-32b-fast', name: 'Qwen 3 32B (Fast)', icon: 'qwen-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, description: "Alibaba's smart all-rounder with thinking", longDescription: "Qwen 3 32B with thinking, hosted on Groq for low latency. Solid all-around chat with reasoning. Note: Groq treats this as preview — may be removed without notice.", developer: 'Alibaba', knowledgeCutoff: '2024-12-01', addedOn: '2025-04-15', aaSlug: 'qwen3-32b-instruct-reasoning', modelsDevId: 'qwen/qwen3-32b', provider: 'groq', route: ROUTES.groq, apiModelId: 'qwen/qwen3-32b' },
			{ id: 'qwen-3', name: 'Qwen 3', icon: 'qwen-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, description: "Alibaba's flagship multimodal thinking model", longDescription: "Qwen 3 is Alibaba's flagship — full multimodal input, native thinking, and competitive performance against the frontier closed-source options.", developer: 'Alibaba', knowledgeCutoff: '2024-12-01', addedOn: '2025-04-15', priceTier: '$$', provider: 'qwen', route: ROUTES.qwen, apiModelId: 'qwen-3' },
			{ id: 'qwen-2.5-max', name: 'Qwen 2.5 Max', icon: 'qwen-color', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, description: "Alibaba's premium chat model", longDescription: "Qwen 2.5 Max is Alibaba's previous flagship general-purpose model. Note: vision lives on the separate `qwen-vl-max` variant — this entry is text-only.", developer: 'Alibaba', knowledgeCutoff: '2024-09-01', addedOn: '2025-01-15', aaSlug: 'qwen-2-5-max', modelsDevId: 'qwen-max', priceTier: '$$', provider: 'qwen', route: ROUTES.qwen, apiModelId: 'qwen-2.5-max' },
		],
	},
	{
		id: 'nvidia',
		name: 'NVIDIA',
		icon: 'nvidia-color',
		models: [
			{ id: 'nemotron-70b', name: 'Nemotron 70B', icon: 'nvidia-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, description: "NVIDIA's tuned Llama 3.1 70B variant", longDescription: "Nemotron 70B is NVIDIA's instruction-tuned variant of Llama 3.1 70B — generally outperforms the base Llama on chat-quality benchmarks.", developer: 'NVIDIA', knowledgeCutoff: '2023-12-01', addedOn: '2024-12-01', aaSlug: 'llama-3-1-nemotron-instruct-70b', modelsDevId: 'nvidia/llama-3.1-nemotron-70b-instruct', provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'nvidia/llama-3.1-nemotron-70b-instruct:free' },
		],
	},
	{
		id: 'xai',
		name: 'xAI',
		icon: 'grok',
		models: [
			{ id: 'grok-3', name: 'Grok 3', icon: 'grok', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, isNew: true, description: "xAI's flagship general-purpose model", longDescription: "Grok 3 is xAI's flagship general-purpose model — strong on current-events knowledge thanks to X integration. Note: Grok 3 (full) is non-reasoning per xAI; only Grok 3 Mini exposes the reasoning_effort knob.", developer: 'xAI', knowledgeCutoff: '2024-09-01', addedOn: '2025-02-20', aaSlug: 'grok-3', modelsDevId: 'grok-3', priceTier: '$$$', provider: 'xai', route: ROUTES.xai, apiModelId: 'grok-3' },
			{ id: 'grok-3-mini', name: 'Grok 3 Mini', icon: 'grok', capabilities: caps({ thinking: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, description: 'Smaller, cheaper Grok 3 variant', longDescription: "The cheaper sibling of Grok 3 — smaller model with reasoning still on board. Use when you want xAI's flavor without flagship pricing.", developer: 'xAI', knowledgeCutoff: '2024-09-01', addedOn: '2025-02-20', aaSlug: 'grok-3-mini-reasoning', modelsDevId: 'grok-3-mini', priceTier: '$$', provider: 'xai', route: ROUTES.xai, apiModelId: 'grok-3-mini' },
		],
	},
	{
		id: 'moonshot',
		name: 'Moonshot',
		icon: 'moonshot',
		models: [
			{ id: 'kimi-k2', name: 'Kimi K2', icon: 'kimi-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, description: "Moonshot's flagship reasoning model", longDescription: "Kimi K2 is Moonshot's flagship reasoning model from China — competitive on math and coding benchmarks, particularly strong on Chinese-language tasks.", developer: 'Moonshot', knowledgeCutoff: '2024-09-01', addedOn: '2025-04-01', aaSlug: 'kimi-k2', modelsDevId: 'kimi-k2-thinking', priceTier: '$$', provider: 'moonshot', route: ROUTES.moonshot, apiModelId: 'kimi-k2' },
		],
	},
	{
		id: 'cohere',
		name: 'Cohere',
		icon: 'cohere-color',
		models: [
			{ id: 'command-r-plus', name: 'Command R+', icon: 'cohere-color', capabilities: caps({ tools: true }), contextWindow: '128K', free: false, enabled: false, description: "Cohere's RAG-optimized flagship", longDescription: "Command R+ is Cohere's RAG-optimized flagship — designed specifically for retrieval-augmented workflows with strong citation generation and tool use.", developer: 'Cohere', knowledgeCutoff: '2024-03-01', addedOn: '2024-12-01', aaSlug: 'command-r-plus-04-2024', modelsDevId: 'command-r-plus-08-2024', priceTier: '$$', provider: 'cohere', route: ROUTES.cohere, apiModelId: 'command-r-plus' },
			{ id: 'command-r', name: 'Command R', icon: 'cohere-color', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, description: "Cohere's standard RAG model", longDescription: "Command R is the cheaper sibling of R+ — same RAG-tuned lineage, smaller model, cheaper per token.", developer: 'Cohere', knowledgeCutoff: '2024-03-01', addedOn: '2024-12-01', aaSlug: 'command-r-03-2024', modelsDevId: 'command-r-08-2024', priceTier: '$', provider: 'cohere', route: ROUTES.cohere, apiModelId: 'command-r' },
		],
	},
	{
		id: 'perplexity',
		name: 'Perplexity',
		icon: 'perplexity-color',
		models: [
			{ id: 'sonar-pro', name: 'Sonar Pro', icon: 'perplexity-color', capabilities: caps({ webSearch: true }), contextWindow: '200K', free: false, enabled: false, description: "Perplexity's high-end web-search model", longDescription: "Sonar Pro is Perplexity's flagship search-augmented model — answers come with built-in web search and citations. Best for current-events and research-style queries.", developer: 'Perplexity', knowledgeCutoff: 'live', addedOn: '2025-01-01', priceTier: '$$$', provider: 'perplexity', route: ROUTES.perplexity, apiModelId: 'sonar-pro' },
			{ id: 'sonar', name: 'Sonar', icon: 'perplexity-color', capabilities: caps({ webSearch: true }), contextWindow: '128K', free: false, enabled: false, description: "Perplexity's standard web-search model", longDescription: "The smaller, cheaper Sonar variant — same search-augmented approach as Sonar Pro at lower cost and shorter context.", developer: 'Perplexity', knowledgeCutoff: 'live', addedOn: '2025-01-01', priceTier: '$$', provider: 'perplexity', route: ROUTES.perplexity, apiModelId: 'sonar' },
		],
	},
	{
		id: 'groq',
		name: 'Groq',
		icon: 'groq',
		models: [
			{ id: 'groq-compound', name: 'Compound', icon: 'groq', capabilities: caps({ webSearch: true, tools: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, description: 'Agentic Groq model with web search and code execution', longDescription: "Groq's agentic offering — bundles web search and code execution natively. The model decides when to invoke tools mid-response. Note: chatCD's current SSE parser does not yet handle Compound's tool-call chunks, so output may render blank when tools fire.", developer: 'Groq', knowledgeCutoff: 'live', addedOn: '2025-04-25', provider: 'groq', route: ROUTES.groq, apiModelId: 'groq/compound' },
			{ id: 'groq-compound-mini', name: 'Compound Mini', icon: 'groq', capabilities: caps({ webSearch: true, tools: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, description: 'Smaller, faster Groq Compound variant', longDescription: 'A smaller, faster version of Groq Compound. Same agentic web-search + code-execution capability, lower latency.', developer: 'Groq', knowledgeCutoff: 'live', addedOn: '2025-04-25', provider: 'groq', route: ROUTES.groq, apiModelId: 'groq/compound-mini' },
		],
	},
	{
		id: 'mixtral',
		name: 'Mixtral',
		icon: 'mistral-color',
		models: [
			// Mixtral 8x7B disabled — Groq deprecated this model in their production
			// catalog. Kept here for reference; flip enabled=true once Groq adds it
			// back or we route through a different provider.
			{ id: 'mixtral-8x7b', name: 'Mixtral 8x7B', icon: 'mistral-color', capabilities: caps(), contextWindow: '32K', free: true, enabled: false, description: 'Mistral 8x7B sparse mixture-of-experts', longDescription: "Mixtral 8x7B is Mistral's classic sparse MoE — 8 experts of 7B, ~13B active params per token. Currently disabled in chatCD because Groq deprecated it; kept for reference.", developer: 'Mistral', knowledgeCutoff: '2023-12-01', addedOn: '2024-12-01', aaSlug: 'mixtral-8x7b-instruct', modelsDevId: 'open-mixtral-8x7b', provider: 'groq', route: ROUTES.groq, apiModelId: 'mixtral-8x7b-32768' },
		],
	},
];

// ─── models.dev augmentation merger ──────────────────────────────────
// At module load, fold in factual fields (context window, knowledge cutoff)
// pulled from models.dev's public dataset by `npm run sync-models`. Hardcoded
// values stay editorial; augmentation only fills in fields it has data for.
// See docs/model-metadata-sources.md for the design rationale.

import { augmentation } from './models-augmentation.generated.js';

for (const company of companies) {
	for (const model of company.models) {
		const aug = augmentation[model.id];
		if (!aug) continue;
		if (aug.contextWindow) model.contextWindow = aug.contextWindow;
		if (aug.knowledgeCutoff) model.knowledgeCutoff = aug.knowledgeCutoff;
		// Capability flags from models.dev override the hardcoded values
		// where present. webSearch and imageGeneration aren't tracked by
		// models.dev — those stay editorial.
		if (aug.capabilities) {
			const c = model.capabilities;
			if (typeof aug.capabilities.thinking === 'boolean') c.thinking = aug.capabilities.thinking;
			if (typeof aug.capabilities.tools === 'boolean') c.tools = aug.capabilities.tools;
			if (typeof aug.capabilities.files === 'boolean') c.files = aug.capabilities.files;
			if (typeof aug.capabilities.vision === 'boolean') c.vision = aug.capabilities.vision;
		}
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function getCompany(companyId: string): Company | undefined {
	return companies.find((c) => c.id === companyId);
}

export function findModel(companyId: string, modelId: string): Model | undefined {
	return getCompany(companyId)?.models.find((m) => m.id === modelId);
}

/** Check if a company has at least one enabled model */
export function hasEnabledModels(company: Company): boolean {
	return company.models.some((m) => m.enabled);
}

export function getDefaultModel(): { companyId: string; modelId: string; modelName: string } {
	const google = companies.find((c) => c.id === 'google');
	const flash = google?.models.find((m) => m.id === 'gemini-2.5-flash');
	if (google && flash) {
		return { companyId: google.id, modelId: flash.id, modelName: flash.name };
	}
	// Fallback to first enabled model
	for (const company of companies) {
		for (const model of company.models) {
			if (model.enabled) {
				return { companyId: company.id, modelId: model.id, modelName: model.name };
			}
		}
	}
	return { companyId: '', modelId: '', modelName: '' };
}
