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
	/** Inference provider serving this model — shown to user as a small chip */
	provider: Provider;
	/** Internal: which API route handles this model */
	route: string;
	/** Internal: the model ID to send to the provider API */
	apiModelId: string;
};

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
			{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: 'gemini-color', capabilities: caps({ vision: true }), contextWindow: '1M', free: true, enabled: true, isNew: true, provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-flash' },
			{ id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', icon: 'gemini-color', capabilities: caps(), contextWindow: '1M', free: true, enabled: true, provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-flash-lite' },
			{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: 'gemini-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '1M', free: true, enabled: true, isNew: true, provider: 'gemini', route: ROUTES.gemini, apiModelId: 'gemini-2.5-pro' },
		],
	},
	{
		id: 'meta',
		name: 'Meta',
		icon: 'meta-color',
		models: [
			{ id: 'meta-llama-3.3-70b', name: 'Llama 3.3 70B', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-3.3-70b-instruct:free' },
			{ id: 'meta-llama-3.3-70b-fast', name: 'Llama 3.3 70B (Fast)', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'llama-3.3-70b-versatile' },
			{ id: 'meta-llama-3.1-8b', name: 'Llama 3.1 8B (Instant)', icon: 'meta-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'llama-3.1-8b-instant' },
			// Groq preview — for evaluation only, may be removed without notice
			{ id: 'meta-llama-4-scout-fast', name: 'Llama 4 Scout (Fast)', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'meta-llama/llama-4-scout-17b-16e-instruct' },
			{ id: 'meta-llama-4-maverick', name: 'Llama 4 Maverick', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '1M', free: false, enabled: false, isNew: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-4-maverick' },
			{ id: 'meta-llama-4-scout', name: 'Llama 4 Scout', icon: 'meta-color', capabilities: caps({ vision: true }), contextWindow: '10M', free: false, enabled: false, isNew: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'meta-llama/llama-4-scout' },
		],
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		icon: 'anthropic',
		models: [
			{ id: 'claude-opus-4', name: 'Claude Opus 4', icon: 'claude-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-opus-4' },
			{ id: 'claude-sonnet-4', name: 'Claude Sonnet 4', icon: 'claude-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-sonnet-4' },
			{ id: 'claude-haiku-3.5', name: 'Claude Haiku 3.5', icon: 'claude-color', capabilities: caps({ vision: true }), contextWindow: '200K', free: false, enabled: false, provider: 'anthropic', route: ROUTES.anthropic, apiModelId: 'claude-haiku-3.5' },
		],
	},
	{
		id: 'openai',
		name: 'OpenAI',
		icon: 'openai',
		models: [
			{ id: 'gpt-oss-120b', name: 'GPT-OSS 120B', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'openai/gpt-oss-120b' },
			{ id: 'gpt-oss-20b', name: 'GPT-OSS 20B', icon: 'openai', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'openai/gpt-oss-20b' },
			{ id: 'gpt-4.1', name: 'GPT-4.1', icon: 'openai', capabilities: caps({ vision: true, tools: true }), contextWindow: '1M', free: false, enabled: false, isNew: true, provider: 'openai', route: ROUTES.openai, apiModelId: 'gpt-4.1' },
			{ id: 'gpt-4o', name: 'GPT-4o', icon: 'openai', capabilities: caps({ vision: true, tools: true }), contextWindow: '128K', free: false, enabled: false, provider: 'openai', route: ROUTES.openai, apiModelId: 'gpt-4o' },
			{ id: 'o3', name: 'o3', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '200K', free: false, enabled: false, provider: 'openai', route: ROUTES.openai, apiModelId: 'o3' },
			{ id: 'o4-mini', name: 'o4-mini', icon: 'openai', capabilities: caps({ thinking: true }), contextWindow: '200K', free: false, enabled: false, isNew: true, provider: 'openai', route: ROUTES.openai, apiModelId: 'o4-mini' },
		],
	},
	{
		id: 'deepseek',
		name: 'DeepSeek',
		icon: 'deepseek-color',
		models: [
			{ id: 'deepseek-r1-free', name: 'DeepSeek R1', icon: 'deepseek-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'deepseek/deepseek-r1:free' },
			{ id: 'deepseek-v3', name: 'DeepSeek V3', icon: 'deepseek-color', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, provider: 'deepseek', route: ROUTES.deepseek, apiModelId: 'deepseek-chat' },
		],
	},
	{
		id: 'mistral',
		name: 'Mistral',
		icon: 'mistral-color',
		models: [
			{ id: 'mistral-small', name: 'Mistral Small', icon: 'mistral-color', capabilities: caps({ tools: true }), contextWindow: '128K', free: true, enabled: true, provider: 'mistral', route: ROUTES.mistral, apiModelId: 'mistral-small-latest' },
			{ id: 'mistral-large', name: 'Mistral Large', icon: 'mistral-color', capabilities: caps({ vision: true, tools: true }), contextWindow: '128K', free: true, enabled: true, provider: 'mistral', route: ROUTES.mistral, apiModelId: 'mistral-large-latest' },
			{ id: 'codestral', name: 'Codestral', icon: 'mistral-color', capabilities: caps(), contextWindow: '256K', free: true, enabled: true, provider: 'mistral', route: ROUTES.mistral, apiModelId: 'codestral-latest' },
		],
	},
	{
		id: 'qwen',
		name: 'Qwen',
		icon: 'qwen-color',
		models: [
			{ id: 'qwen3-coder-free', name: 'Qwen3 Coder 480B', icon: 'qwen-color', capabilities: caps(), contextWindow: '262K', free: true, enabled: true, isNew: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'qwen/qwen3-coder-480b:free' },
			// Groq preview — for evaluation only, may be removed without notice
			{ id: 'qwen3-32b-fast', name: 'Qwen 3 32B (Fast)', icon: 'qwen-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'qwen/qwen3-32b' },
			{ id: 'qwen-3', name: 'Qwen 3', icon: 'qwen-color', capabilities: caps({ thinking: true, vision: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, provider: 'qwen', route: ROUTES.qwen, apiModelId: 'qwen-3' },
			{ id: 'qwen-2.5-max', name: 'Qwen 2.5 Max', icon: 'qwen-color', capabilities: caps({ vision: true }), contextWindow: '128K', free: false, enabled: false, provider: 'qwen', route: ROUTES.qwen, apiModelId: 'qwen-2.5-max' },
		],
	},
	{
		id: 'nvidia',
		name: 'NVIDIA',
		icon: 'nvidia-color',
		models: [
			{ id: 'nemotron-70b', name: 'Nemotron 70B', icon: 'nvidia-color', capabilities: caps(), contextWindow: '128K', free: true, enabled: true, provider: 'openrouter', route: ROUTES.openrouter, apiModelId: 'nvidia/llama-3.1-nemotron-70b-instruct:free' },
		],
	},
	{
		id: 'xai',
		name: 'xAI',
		icon: 'grok',
		models: [
			{ id: 'grok-3', name: 'Grok 3', icon: 'grok', capabilities: caps({ thinking: true, vision: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, provider: 'xai', route: ROUTES.xai, apiModelId: 'grok-3' },
			{ id: 'grok-3-mini', name: 'Grok 3 Mini', icon: 'grok', capabilities: caps({ thinking: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, provider: 'xai', route: ROUTES.xai, apiModelId: 'grok-3-mini' },
		],
	},
	{
		id: 'moonshot',
		name: 'Moonshot',
		icon: 'moonshot',
		models: [
			{ id: 'kimi-k2', name: 'Kimi K2', icon: 'kimi-color', capabilities: caps({ thinking: true }), contextWindow: '128K', free: false, enabled: false, isNew: true, provider: 'moonshot', route: ROUTES.moonshot, apiModelId: 'kimi-k2' },
		],
	},
	{
		id: 'cohere',
		name: 'Cohere',
		icon: 'cohere-color',
		models: [
			{ id: 'command-r-plus', name: 'Command R+', icon: 'cohere-color', capabilities: caps({ tools: true }), contextWindow: '128K', free: false, enabled: false, provider: 'cohere', route: ROUTES.cohere, apiModelId: 'command-r-plus' },
			{ id: 'command-r', name: 'Command R', icon: 'cohere-color', capabilities: caps(), contextWindow: '128K', free: false, enabled: false, provider: 'cohere', route: ROUTES.cohere, apiModelId: 'command-r' },
		],
	},
	{
		id: 'perplexity',
		name: 'Perplexity',
		icon: 'perplexity-color',
		models: [
			{ id: 'sonar-pro', name: 'Sonar Pro', icon: 'perplexity-color', capabilities: caps({ webSearch: true }), contextWindow: '200K', free: false, enabled: false, provider: 'perplexity', route: ROUTES.perplexity, apiModelId: 'sonar-pro' },
			{ id: 'sonar', name: 'Sonar', icon: 'perplexity-color', capabilities: caps({ webSearch: true }), contextWindow: '128K', free: false, enabled: false, provider: 'perplexity', route: ROUTES.perplexity, apiModelId: 'sonar' },
		],
	},
	{
		id: 'groq',
		name: 'Groq',
		icon: 'groq',
		models: [
			{ id: 'groq-compound', name: 'Compound', icon: 'groq', capabilities: caps({ webSearch: true, tools: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'groq/compound' },
			{ id: 'groq-compound-mini', name: 'Compound Mini', icon: 'groq', capabilities: caps({ webSearch: true, tools: true }), contextWindow: '128K', free: true, enabled: true, isNew: true, provider: 'groq', route: ROUTES.groq, apiModelId: 'groq/compound-mini' },
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
			{ id: 'mixtral-8x7b', name: 'Mixtral 8x7B', icon: 'mistral-color', capabilities: caps(), contextWindow: '32K', free: true, enabled: false, provider: 'groq', route: ROUTES.groq, apiModelId: 'mixtral-8x7b-32768' },
		],
	},
];

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
