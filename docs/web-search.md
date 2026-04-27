# Web search in Uni Chat

How the Search button in the chat composer actually works (or will work). Last researched: 2026-04-27.

## What the major chat clients do

| Product | Approach | Backend | Notes |
|---|---|---|---|
| **ChatGPT Search** | Hybrid: own index (OAI-Searchbot crawler) + third-party search engines | Microsoft Bing (primary partner) | Rewrites the user query into one or more targeted queries before sending. Pre-injection style. Captured ~17–18% of global query market by 2026. |
| **Anthropic Claude API** | Native server-side `web_search` tool (`web_search_20260209` is current) | **Brave Search** | Tool-call style: model decides when to invoke, Anthropic intercepts and runs search server-side. ~$10 per 1k searches. New version supports dynamic filtering before results enter context to save tokens. |
| **Gemini Grounding** | Native `google_search` tool | Google Search index | Query classifier scores 0–1 to decide whether to search. Query transformation. Returns grounded snippets + Search Suggestions. Billed per executed search query. |
| **DeepSeek (deepseek.com chat)** | Toggle in the UI runs RAG behind the scenes | Third-party (Bing/Google/Tavily commonly) | Not native to their API — for API users it's BYO tool. R1 specifically is praised as "the first reasoning model to master web search" — i.e., if you wire a tool, R1 uses it well, but DeepSeek doesn't run search for you. |
| **xAI Grok** | Native "Live Search" with X integration | xAI's own + X corpus | Specialized for current-events / X content. |
| **T3.chat** | Couldn't confirm publicly. Likely hardcoded per-provider hybrid (native where available, custom elsewhere). | n/a | |

The takeaway: every product that ships a Search button has *some* backend doing the actual web fetch. There's no "the model does search itself" — even native tools like Anthropic's run server-side and call out to Brave / Bing / Google.

## Search backend landscape (2026)

Pricing and free tier comparison for the search APIs that target LLM use cases:

| Provider | Free tier | Paid | Strengths | Notes |
|---|---|---|---|---|
| **Tavily** | **1,000 credits / month** | $30/mo Researcher, $100/mo Startup | Designed for LLM retrieval, citation-ready structured output, LangChain integration, source credibility scoring | Best ergonomics for our use case. AI-native. |
| **Exa** | 1,000 credits / month | $5 / 1k neural searches | Embedding-based ranking — best when conceptual relevance > recency | Good for "find me models like X" type queries; weaker on news/current-events. |
| **Brave Search API** | None (recently removed) | $5–9 / 1k requests | Independent privacy-focused index; powers Anthropic's tool | Honest index, but adds a new paid surface. |
| **Linkup** | €5 / month free credits | €5 / 1k standard, €50 / 1k deep | 5K-char structured snippets, MCP/LangChain connectors | EU-hosted. |
| **Serper** | None | $50/mo | Google SERP-style results, broad engine coverage | Lower-level; needs more post-processing. |
| **SerpAPI** | None (trial) | ~$50/mo+ | 40+ search engines unified | Generalist; not LLM-tuned. |
| **Firecrawl** | Limited | Tiered | Search + full page extraction in one call | Heaviest, best for deep research. |
| **You.com** | Limited | Tiered | Niche, reasonable LLM-friendliness | Less momentum. |

Benchmark from a public AI-agent eval (informal, single source): Exa 8.7, Tavily 8.6, Serper 8.0, Brave 7.1.

## Architectural patterns

### Pre-injection
Server runs a search before the model call, prepends the results to the user's message as context, sends augmented prompt to the model. One extra HTTP call's latency. The model doesn't decide — every search-toggled message triggers a search. Implementation simple; no streaming changes needed.

### Tool-calling
Server adds a `search_web` tool to the request. Model decides whether to call it. If it does, the response stream emits a tool-call chunk; server intercepts, runs search, sends results back as tool-result message, model continues. More natural — no search happens unless the model asks. But requires multi-turn streaming and per-provider tool-call normalization (Anthropic's `tool_use`, OpenAI's `function_call`, Gemini's `functionCall`, etc.).

### Native (provider-side)
Pass a flag/tool that the provider already supports (Gemini's `google_search`, Anthropic's `web_search`). Provider handles search server-side and returns answers with citations. Quality varies by backend (Google Search > Brave > others). Costs are per-provider.

## Decision for v1

**Pre-injection with Tavily for all models.**

Rationale:
- Single code path that works across every model in our catalog (Gemini free tier, Groq free, OpenRouter free, Mistral free, plus the disabled paid stubs when they get wired up).
- Tavily's free tier (1k searches/month) covers all of dev.
- Pre-injection avoids the multi-turn streaming + per-provider tool-call normalization we'd need for tool-calling. We can add tool-calling later if specific models would benefit.
- AI-native API → minimal post-processing needed; Tavily returns clean citation-ready snippets.
- Easy to swap (the abstraction is a `searchWeb(query)` function in `lib/server/web-search.ts` — backend-pluggable later).

What we're explicitly *not* doing in v1:
- **Native paths** (Gemini grounding, Anthropic web_search, Groq Compound's built-in search). These would give better quality for those specific models, but they're optimizations — different code per provider, different billing surfaces. Adding them is a future session once usage tells us where the cost/quality tradeoff matters.
- **Query rewriting**. We pass the user's message verbatim to Tavily. Most modern search APIs (Tavily included) handle conversational queries reasonably.
- **Caching**. User queries vary too much to cache cheaply. Tavily's quota covers dev easily.
- **Tier gating**. Free for everyone in v1; rate limiter handles abuse. Reconsider if bills surprise us.

## How v1 works in this repo

1. **`.env`:** add `TAVILY_API_KEY=tvly-...` (server-side only, not exposed to the browser).
2. **Browser:** the existing Search toggle in `chat-view.svelte` sends `{ webSearch: true }` in the request body when on. (Wiring this is part of v1.)
3. **`/api/chat`:** before forwarding to the provider, if `webSearch: true`:
   - Take the most recent user message's content as the query.
   - Call `searchWeb(query)` from `src/lib/server/web-search.ts` (Tavily client).
   - Prepend the search results to the user message as inline context.
   - Forward to the provider with the augmented messages.
4. **`src/lib/server/web-search.ts`:** small Tavily wrapper. Single `searchWeb(query, { maxResults })` function. Handles missing API key (returns null, search is silently skipped). Logs failures.
5. **No new browser endpoint.** Search is purely server-side; the browser only sees the toggle.

## Future work

- **Compound SSE parser fix** — Groq's Compound emits tool-call chunks our SSE parser doesn't handle. With that fixed, Compound's native agentic search would render correctly and we'd skip Tavily for Compound queries.
- **Native Gemini grounding** — pass `tools: [{ google_search: {} }]` in the Gemini provider when `webSearch: true`. Free under Gemini's free tier (within their RPD).
- **Native Anthropic web_search** — when we wire up the Anthropic provider, use the `web_search` tool instead of Tavily for Claude.
- **Tool-calling pattern** — let the model decide when to search rather than always-on. Requires multi-turn streaming groundwork (also needed for Compound).
- **Tier gating + quota** — once usage data exists, decide whether free users keep unlimited search or get a quota.

## Sources

- [Introducing ChatGPT search — OpenAI](https://openai.com/index/introducing-chatgpt-search/)
- [ChatGPT now lets you search the internet — MIT Technology Review](https://www.technologyreview.com/2024/10/31/1106472/chatgpt-now-lets-you-search-the-internet/)
- [Web search tool — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Introducing web search on the Anthropic API — Claude](https://claude.com/blog/web-search-api)
- [Grounding with Google Search — Gemini API](https://ai.google.dev/gemini-api/docs/google-search)
- [Tracking DeepSeek R1: First reasoning model to master web search](https://www.tryprofound.com/blog/deepseek-r1-model-to-master-web-search)
- [Best Web Search APIs for AI Applications in 2026 — Firecrawl blog](https://www.firecrawl.dev/blog/best-web-search-apis)
- [Exa vs Tavily vs Serper vs Brave Search for AI Agents](https://dev.to/supertrained/exa-vs-tavily-vs-serper-vs-brave-search-for-ai-agents-an-score-comparison-2l1g)
- [Tavily Pricing 2026](https://costbench.com/software/web-scraping/tavily/)
