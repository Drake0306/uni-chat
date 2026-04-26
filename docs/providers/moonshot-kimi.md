# Moonshot (Kimi) — Direct

**Role:** Niche provider. Strong on long-context and Chinese language tasks.

## Integration

- **Endpoint:** `https://api.moonshot.cn/v1/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible

## Free Tier

- Free credits on signup (small amount, exact value unpublished)
- $5 voucher bonus when cumulative recharge hits $5
- No lasting free tier

## Models & Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| Kimi K2.5 | $0.60 | $2.50 | 128K |
| Kimi K2 | $0.60 | $2.50 | 128K |
| Cached tokens | $0.15 | — | — |

## Rate Limits (by cumulative spend)

| Tier | Threshold | Concurrent | RPM |
|---|---|---|---|
| Tier 1 | $10 | 50 | 200 |
| Higher tiers | More spend | More capacity | Higher RPM |

## Caveats

- China-based provider
- Primarily targets Chinese market
- Limited English documentation
- 2M+ token context window on paid plans only

## Uni Chat Plan

### Free tier users
- Route through **OpenRouter** if Kimi is available there as a free model
- Otherwise, no free access

### Pro tier users
- Direct API access for users who want Kimi specifically
- Good for long-context tasks

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/moonshot/+server.ts`
- Lower priority — implement after core providers
- Consider routing through OpenRouter instead of direct integration
