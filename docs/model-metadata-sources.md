# Model metadata sources

How Uni Chat knows which models exist and what they support — and what we have to figure out ourselves.

Last researched: 2026-04-27.

## TL;DR

No single API gives us everything we need for the UI. Capability metadata is fragmented across providers and third-party registries. **Most chat clients hardcode a config table and accept that new model launches need manual updates.** That's what we do, with a small amount of auto-augmentation from [models.dev](https://models.dev) (Option 2 below).

Even OpenAI and Anthropic do this internally for their own chat UIs (ChatGPT, Claude.ai) — the product team that ships the model also maintains the capability config. They don't query their own `/v1/models` to discover what GPT-5 supports.

## What each external API exposes

### OpenRouter — the richest single source

`GET https://openrouter.ai/api/v1/models` (no auth required). Per-model fields:

| Field | What it tells you |
|---|---|
| `architecture.input_modalities` | `["text", "image"]` → vision support |
| `architecture.output_modalities` | `["text", "image"]` → image-gen support |
| `supported_parameters[]` | Includes `tools` / `tool_choice` (tool calling), `reasoning` / `include_reasoning` (thinking), `response_format` (structured output) |
| `context_length`, `top_provider.max_completion_tokens` | Token limits |
| `pricing` | Per-token cost |
| `knowledge_cutoff` | When set |
| `description` | Plain-text capability summary |

Covers ~300 models routed through OpenRouter. Best programmatic source if a model is OR-routable.

### models.dev — community registry (✅ what we use for augmentation)

`curl https://models.dev/api.json` (no auth, MIT licensed, ~1,700 models, actively maintained). Per-model fields:

- `attachment` (file uploads), `reasoning`, `tool_call` — booleans
- `modalities.input/output` arrays
- `cost.input/output` ($USD per million tokens), plus `cost.reasoning`, `cost.cache_read/write` when applicable
- `limit.context/input/output` (token counts)
- `release_date`, `last_updated`, `knowledge` (cutoff), `status` (alpha / beta / deprecated)
- `open_weights` (boolean)

**Doesn't track:** image generation, web search, effort levels (chatCD's "low/medium/high" concept).

Source: [github.com/anomalyco/models.dev](https://github.com/anomalyco/models.dev).

### Google Gemini

`GET /v1beta/models?key=...`. Returns `supportedGenerationMethods`, `inputTokenLimit`, `outputTokenLimit`, parameter ranges. Modest. No explicit "vision" flag — you infer from generation methods.

### OpenAI / Anthropic / Mistral / Groq / xAI / DeepSeek

`GET /v1/models` returns `[{id, owned_by, created}]`. **No capability metadata.**

There's an [active OpenAI community thread](https://community.openai.com/t/expose-model-capabilities-in-the-v1-models-api-response/1314117) asking OpenAI to expose `function_calling`, `structured_outputs`, `tool_choice` flags on the models endpoint — they haven't done it yet.

For these providers, the capability data lives in their docs pages, not their APIs. You read the docs and hardcode.

### Artificial Analysis

Already used for benchmarks. Per-model fields include `slug`, `name`, `evaluations.*` (intelligence/coding/math indices, MMLU-Pro, GPQA, etc.), `pricing`, `median_output_tokens_per_second`. Not great for capability flags — focused on performance.

## What's never in any external source

These are inherently product decisions, not provider facts. We hardcode them:

| Concept | Why it can't be auto-discovered |
|---|---|
| Effort levels (`low / medium / high`) | Each provider exposes thinking differently — Anthropic budget tokens, OpenAI `reasoning_effort` enum, Gemini thinking budget. The unified taxonomy is something we impose. |
| Web search | Only agentic models (Groq Compound, Perplexity Sonar) have it as a model capability. For others, it's a tool the app implements separately. |
| Image generation | Some models do it inline (Gemini 2.5 Flash Image), some require separate endpoints. Hard to flag uniformly. |
| Recommended / curated subset | Pure editorial. |
| Price tier ($, $$, $$$) | Editorial bucketing of `cost.input` numbers. |
| BYOK | App-level concept (does our UI expose a key field for this provider?). |
| Long-form descriptions | Marketing copy — provider docs are too verbose, registries too terse. |

## Architectural options

### Option 1 — Stay hardcoded

`models.ts` is the canonical source of truth. Every field is editorially controlled.

**Pros:** total control, no runtime dependency, works offline. **Cons:** every new model launch requires a manual `models.ts` edit including factual fields (context window, knowledge cutoff) that could be auto-populated.

### Option 2 — Hybrid: hardcoded base + augment from models.dev at build time ✅ chosen

`models.ts` stays canonical for editorial fields. A build-time sync script (`npm run sync-models`) hits models.dev's API and writes a generated TypeScript module with augmentation values for *factual* fields (context window, knowledge cutoff, pricing, release date) keyed by `modelsDevId`. The augmentation is committed so builds are deterministic.

At module load, `models.ts` merges augmentation onto the hardcoded entries — augmented fields override hardcoded values where they exist; otherwise the hardcoded value stands.

**Pros:** editorial fields stay yours; factual fields auto-update; no runtime fetch; deterministic builds. **Cons:** extra complexity; needs an `id → modelsDevId` mapping (similar to `aaSlug`).

### Option 3 — Hybrid: OpenRouter-only augmentation

For models with `provider: 'openrouter'`, fetch OpenRouter's models endpoint at build time and use its richer schema. For other providers, stay hardcoded.

**Pros:** OpenRouter's schema is richer than models.dev. **Cons:** only helps for OR-routed models.

### Option 4 — Generate `models.ts` from a registry with manual overrides

Treat models.dev as canonical for capabilities; `models.ts` becomes overrides only.

**Pros:** minimal manual work for routine launches. **Cons:** chatCD becomes a thin shim over an external dataset; if models.dev goes stale, the catalog goes stale.

## Why Option 2

- Keeps editorial control over user-facing copy and chatCD-specific concepts.
- Reduces manual work on routine factual updates (a model's context window or knowledge cutoff changes, models.dev tracks it, we re-sync).
- Deterministic builds — the augmentation file is committed, no runtime fetches.
- If models.dev disappears, we still have the last synced snapshot in the repo.

## How Option 2 works in this repo

1. `Model.modelsDevId?: string` — added to the type. The mapping field, set per-model in `src/lib/config/models.ts` for any model present on models.dev.
2. `scripts/sync-model-data.ts` — Node script invoked via `npm run sync-models`. Hits `https://models.dev/api.json`, finds matches by `modelsDevId`, writes `src/lib/config/models-augmentation.generated.ts`.
3. `src/lib/config/models-augmentation.generated.ts` — committed to repo. Exports an object keyed by our model `id`. Auto-generated; do not edit.
4. `src/lib/config/models.ts` — at module load, iterates the `companies` array and merges each model's augmentation entry onto it (augmentation values win where present).

To refresh:
```
npm run sync-models
git diff src/lib/config/models-augmentation.generated.ts
git add ...    # if you like the diff
```

## Updating per-model when a new model launches

1. Add the entry to `models.ts` with hardcoded editorial fields (`description`, `longDescription`, `priceTier`, `aaSlug`, `modelsDevId`, capability flags). The Fast/Low/Med/High effort picker is shown automatically when `capabilities.thinking` is true (no separate field needed).
2. Run `npm run sync-models` — augmentation pulls factual fields if models.dev has them.
3. Run `npm run check`.
4. Commit both `models.ts` and the regenerated augmentation file.

If models.dev doesn't have the model yet (new launches lag), set `modelsDevId: undefined` and hardcode `contextWindow` / `knowledgeCutoff` directly. Re-sync later when they pick it up.

## Sources

- [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- [models.dev (anomalyco/models.dev)](https://github.com/anomalyco/models.dev) — MIT, public JSON at https://models.dev/api.json
- [Expose Model Capabilities in /v1/models API Response — OpenAI Community](https://community.openai.com/t/expose-model-capabilities-in-the-v1-models-api-response/1314117)
- [OpenAI API: Models docs](https://developers.openai.com/api/docs/models)
- [Reasoning models — OpenAI API guide](https://platform.openai.com/docs/guides/reasoning)
- [Artificial Analysis API](https://artificialanalysis.ai/documentation) — used for benchmarks (separate concern)
