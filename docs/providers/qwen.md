# Qwen (Alibaba / DashScope)

**Role:** Strong open-weight models. Available free via OpenRouter, limited free via direct.

## Integration (Direct — DashScope)

- **Endpoint:** Singapore: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- **Auth:** Bearer token (DashScope API key)
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible

## Free Tier (DashScope Singapore endpoint)

| Feature | Limit |
|---|---|
| Free quota | 1M input + 1M output tokens |
| Expiry | 90 days after activation |
| Credit card | Not required |

No free quota on US Virginia or China Mainland endpoints.

## Models & Pricing (paid)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| Qwen 3 | Tiered by request size | Tiered | 128K |
| Qwen 2.5 Max | Tiered by request size | Tiered | 128K |
| Qwen3 Coder | Tiered by request size | Tiered | 262K |

Pricing is tiered based on single-request input size, not cumulative.

## Better Free Access via OpenRouter

**Qwen3 Coder 480B** is available as a **free model on OpenRouter** — strongest free coding model available. This is the recommended path for free tier users.

## Uni Chat Plan

### Free tier users
- Route Qwen models through **OpenRouter free** (Qwen3 Coder 480B)
- No direct DashScope integration needed for free tier

### Pro tier users
- Direct DashScope API for users who want Qwen specifically
- Or route through OpenRouter paid

### Implementation
- Primarily use OpenRouter for Qwen access
- Direct DashScope integration is lower priority
- If implemented: `src/routes/api/providers/qwen/+server.ts`
