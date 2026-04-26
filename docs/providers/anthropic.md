# Anthropic (Claude) — Direct

**Role:** Premium provider. Gated behind paid subscription tiers.

## Why Direct (not through OpenRouter)

- Avoid OpenRouter's 5% markup on high-volume usage
- Direct access to latest features (extended thinking, tool use, vision)
- Better rate limits on direct API

## Integration

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Auth:** `x-api-key` header
- **Streaming:** Supported (SSE)
- **SDK:** `@anthropic-ai/sdk` npm package

## Free Tier

**No lasting free tier.** ~$5 starter credit on signup. Once gone, prepay required.

## Models & Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| Claude Opus 4.7 | $5.00 | $25.00 | 200K |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 200K |
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K |

### Cost Reduction

- **Prompt caching:** Cached reads at 10% of input price
- **Batch API:** 50% off for non-real-time workloads

## Rate Limits (by spend tier)

| Tier | Threshold | RPM | Tokens/Min |
|---|---|---|---|
| Tier 1 | $0 | 50 | 40,000 |
| Tier 2 | $40 | 1,000 | 80,000 |
| Tier 3 | $200 | 2,000 | 160,000 |
| Tier 4 | $400 | 4,000 | 400,000 |

## Uni Chat Plan

### Free tier users
- **No access.** Claude is not available on free tier.
- Show as locked with "Upgrade to use Claude" prompt

### Pro tier users ($X/mo)
- Access to Claude Sonnet 4.6 and Haiku 4.5
- Per-user limit: 50 req/hour
- Default to Sonnet for quality, Haiku for speed

### Max tier users ($XX/mo)
- Access to Claude Opus 4.7
- Per-user limit: 30 req/hour (Opus is expensive)

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/anthropic/+server.ts`
- Subscription check middleware — reject if user is not on paid tier
- Prompt caching enabled by default for system prompts
