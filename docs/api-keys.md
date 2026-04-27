# API keys for Uni Chat

This is the single reference for every external service Uni Chat talks to. Each section explains:

- What the key unlocks
- Where to sign up
- What goes in `.env`
- What happens if the key is missing

All keys go in `.env` at the project root (copy `.env.example` and fill in). Only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are exposed to the browser; everything else is server-side only.

---

## Free LLM providers (required for the free tier)

### OpenRouter

- **What it unlocks:** Llama 3.3 / 4, DeepSeek R1, Qwen3 Coder, Nemotron — all via OpenRouter's `:free` routes.
- **Sign up:** <https://openrouter.ai/keys>. Free, no credit card.
- **`.env`:** `OPENROUTER_API_KEY=sk-or-v1-...`
- **Without it:** any model with `provider: 'openrouter'` returns 500.

### Google Gemini

- **What it unlocks:** Gemini 2.5 Flash / Flash-Lite / Pro.
- **Sign up:** <https://aistudio.google.com/apikey>. Free, no credit card. Free tier has generous limits.
- **`.env`:** `GEMINI_API_KEY=AIza...`
- **Without it:** any model with `provider: 'gemini'` returns 500.

### Groq

- **What it unlocks:** Llama 3.3 (Fast), Llama 3.1 8B Instant, Llama 4 Scout (Fast), GPT-OSS 120B / 20B, Qwen 3 32B (Fast), Compound, Compound Mini.
- **Sign up:** <https://console.groq.com/keys>. Free, no credit card. Per-day rate limits per model — see Groq's pricing page.
- **`.env`:** `GROQ_API_KEY=gsk_...`
- **Without it:** any model with `provider: 'groq'` returns 500.

### Mistral

- **What it unlocks:** Mistral Small / Large / Codestral.
- **Sign up:** <https://console.mistral.ai/api-keys>. Free tier requires phone verification.
- **`.env`:** `MISTRAL_API_KEY=...`
- **Without it:** any model with `provider: 'mistral'` returns 500.

---

## Paid LLM providers (optional — currently stubs)

These provider routes return 403 today; flip the corresponding model's `enabled: true` in `src/lib/config/models.ts` and implement the provider's `/src/routes/api/providers/<name>/+server.ts` to use them. Keys aren't needed until you do.

| Provider | Key var | Sign-up |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | <https://console.anthropic.com/> |
| OpenAI | `OPENAI_API_KEY` | <https://platform.openai.com/api-keys> |
| xAI | `XAI_API_KEY` | <https://console.x.ai/> |
| DeepSeek | `DEEPSEEK_API_KEY` | <https://platform.deepseek.com/> |
| Moonshot | `MOONSHOT_API_KEY` | <https://platform.moonshot.ai/> |
| Cohere | `COHERE_API_KEY` | <https://dashboard.cohere.com/api-keys> |
| Perplexity | `PERPLEXITY_API_KEY` | <https://www.perplexity.ai/settings/api> |
| Qwen / Alibaba | `QWEN_API_KEY` | <https://dashscope.console.aliyun.com/> |

All except Qwen require a credit card. Qwen requires an Alibaba Cloud account.

---

## Supabase (auth + chat persistence)

- **What it unlocks:** Google SSO, chat history persistence, per-user model selections, rate-limit tier lookup.
- **Sign up:** <https://supabase.com/dashboard>. Free tier is generous.
- **Setup:**
  1. Create a project.
  2. From **Settings → API**, copy the project URL and the anon (publishable) key. From **Settings → API → Service Role**, copy the service role key (treat as a secret).
  3. From **Authentication → Providers**, enable Google and configure the OAuth client. Add `https://<project>.supabase.co/auth/v1/callback` to your Google OAuth redirect URIs.
  4. Run migrations: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.
- **`.env`:**
  ```
  PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
  PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
  ```
- **Without it:** auth fails entirely, chats fall back to localStorage, settings page redirects to `/`.

---

## Artificial Analysis (benchmark data on the model detail page)

- **What it unlocks:** Intelligence / Coding / Math indices and sub-benchmarks (MMLU-Pro, GPQA, SciCode, LiveCodeBench, MATH-500, AIME) on `/settings/models/[id]`.
- **Sign up:**
  1. Go to <https://artificialanalysis.ai/documentation> and follow the link to the **Insights Platform** (you may need to create an account on the Insights Platform separately from any AA browsing account).
  2. Once signed in, generate an API key from your Insights Platform dashboard.
  3. The free tier permits **1,000 requests per day**. Uni Chat's server caches the entire LLM dataset for 24 hours, so under normal use we make **1 request per day** total.
- **`.env`:** `ARTIFICIAL_ANALYSIS_API_KEY=<key>`
- **Without it:** every model detail page renders "Benchmark data not available." All other functionality works.
- **Attribution:** Required by AA's TOS. Uni Chat shows "via Artificial Analysis" with a link on every detail page that displays this data.
- **Slug mapping:** Each model in `src/lib/config/models.ts` has an `aaSlug` that matches AA's URL (e.g., `claude-4-sonnet` → `https://artificialanalysis.ai/models/claude-4-sonnet`). If a slug returns no data, fix it in `models.ts` — visit the AA site, find the model's URL, copy the slug.

---

## Dev settings

### `BYPASS_RATE_LIMIT`

- Set to `true` to skip Uni Chat's internal rate limiter during development. Default `false`.
- Has no effect on upstream provider rate limits.

---

## Quick checklist for a fresh dev environment

1. `cp .env.example .env`
2. Sign up for and paste in: **OPENROUTER_API_KEY**, **GEMINI_API_KEY**, **GROQ_API_KEY**, **MISTRAL_API_KEY** (free, no CC).
3. Set up Supabase, paste **PUBLIC_SUPABASE_URL** + **PUBLIC_SUPABASE_ANON_KEY** + **SUPABASE_SERVICE_ROLE_KEY**, run migrations.
4. (Optional but recommended) Sign up at Artificial Analysis Insights, paste **ARTIFICIAL_ANALYSIS_API_KEY**.
5. `npm install && npm run dev`.

Skipping step 4 is fine for development — the model detail pages just show "Benchmark data not available."
