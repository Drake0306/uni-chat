# OpenRouter

**Role:** Primary backbone. Single API for 290+ models across all providers.

## Why OpenRouter

- One API key, one endpoint, one billing — covers OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, xAI, and more
- OpenAI-compatible API — drop-in replacement, works with any OpenAI SDK
- Built-in fallbacks — pass an array of models, it tries each until one succeeds
- 29 free models included at zero cost

## Integration

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Auth:** Bearer token (single API key)
- **Streaming:** Supported (SSE)
- **SDK:** Any OpenAI-compatible SDK works

## Free Models (no credit card, no expiry)

| Model | Context | Notes |
|---|---|---|
| Llama 3.3 70B Instruct | 128K | GPT-4 level, best free general model |
| Qwen3 Coder 480B | 262K | Strongest free coding model |
| DeepSeek R1 (free) | 128K | Strong reasoning |
| GPT-OSS 120B | 128K | OpenAI's open-weight model |
| Gemma 3 12B | 128K | Google's open model |
| Mistral 7B Instruct | 32K | Fast, lightweight |
| NVIDIA Nemotron 3 Super | 262K | Hybrid architecture |

Full list: https://openrouter.ai/collections/free-models

## Rate Limits

| Condition | Daily Limit | Per-Minute |
|---|---|---|
| No credits purchased | 50 req/day | 20 RPM |
| $10+ credits purchased | 1000 req/day | 20 RPM |
| Paid models | Per-provider limits | Varies by model |

## Pricing (paid models via OpenRouter)

5% markup over direct provider pricing. Examples:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Claude Sonnet 4.6 | $3.15 | $15.75 |
| GPT-4o | $2.63 | $10.50 |
| Gemini 2.5 Pro | $1.31 | $10.50 |

## Uni Chat Plan

### Free tier users
- Route to free models: Llama 3.3 70B (default), Qwen3 Coder, DeepSeek R1
- Rate limit per user: 30 req/hour, 200 req/day
- No OpenRouter credits needed initially

### Paid tier users
- Route to any model via OpenRouter paid
- Purchase OpenRouter credits to unlock 1000 free model req/day
- Use OpenRouter's fallback array for reliability

### Implementation
- Single `+server.ts` endpoint at `src/routes/api/providers/openrouter/+server.ts`
- Proxy all requests — never expose API key to client
- Track per-user usage in session/DB for rate limiting
