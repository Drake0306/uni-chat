# xAI (Grok) — Direct

**Role:** Premium provider with generous signup credits. Gated behind paid tiers.

## Why Direct

- $25 free signup credits — most generous of any provider
- Additional $150/month if user opts into data sharing program
- Grok 3 is competitive with Claude and GPT on reasoning

## Integration

- **Endpoint:** `https://api.x.ai/v1/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible

## Free Tier

**No lasting free tier.** But:
- $25 signup credits (no CC required initially)
- $150/month bonus if you share data with xAI

## Models & Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| Grok 4 | $3.00 | $15.00 | 256K |
| Grok 4.1 Fast | $0.20 | $1.00 | 128K |
| Grok 3 | $3.00 | $15.00 | 128K |
| Grok 3 Mini | $0.30 | $0.50 | 128K |

## Rate Limits (by cumulative spend since Jan 2026)

Tiers unlock automatically based on spend. Strict RPM/TPM per model.

## Uni Chat Plan

### Free tier users
- **No access.** Grok is not available on free tier.

### Pro tier users
- Access to Grok 4.1 Fast (cheap and fast)
- Per-user limit: 40 req/hour

### Max tier users
- Access to Grok 4 and Grok 3
- Per-user limit: 20 req/hour

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/xai/+server.ts`
- Subscription check middleware
- Consider data sharing program for the $150/mo bonus credits
