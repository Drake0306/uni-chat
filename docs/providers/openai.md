# OpenAI — Direct

**Role:** Premium provider. Gated behind paid subscription tiers.

## Why Direct (not through OpenRouter)

- Avoid 5% markup at scale
- Direct access to latest models (GPT-4.1, o3, o4-mini)
- Better streaming performance

## Integration

- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** `openai` npm package

## Free Tier

**Effectively none.** Free tier is GPT-3.5 Turbo only at 3 RPM. GPT-4o and above require payment.

Conflicting reports on whether new accounts still get $5 starter credit.

## Models & Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| GPT-4.1 | $2.00 | $8.00 | 1M |
| GPT-4o | $2.50 | $10.00 | 128K |
| o3 | $2.00 | $8.00 | 200K |
| o4-mini | $1.10 | $4.40 | 200K |
| GPT-4o mini | $0.15 | $0.60 | 128K |

## Rate Limits (by spend tier)

| Tier | Threshold | RPM | TPM |
|---|---|---|---|
| Free | $0 | 3 | 40,000 |
| Tier 1 | $5 | 500 | 200,000 |
| Tier 2 | $50 | 5,000 | 2,000,000 |
| Tier 3 | $100 | 5,000 | 10,000,000 |

## Uni Chat Plan

### Free tier users
- **No access.** OpenAI models not available on free tier.
- Could offer GPT-4o mini via OpenRouter free if available, otherwise locked

### Pro tier users
- Access to GPT-4o, GPT-4.1, o4-mini
- Per-user limit: 50 req/hour

### Max tier users
- Access to o3 (reasoning model)
- Per-user limit: 30 req/hour

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/openai/+server.ts`
- Subscription check middleware
- Use GPT-4o mini as cost-effective default for Pro users
