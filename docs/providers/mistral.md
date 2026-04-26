# Mistral — Direct

**Role:** Free tier provider with generous limits. Good quality European models.

## Why Direct (not through OpenRouter)

- 1 billion tokens/month free — far more generous than OpenRouter's free model limits
- Access to full model lineup including Mistral Large and Codestral
- No credit card required (phone verification only)

## Integration

- **Endpoint:** `https://api.mistral.ai/v1/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible or `@mistralai/mistralai` npm package

## Free Tier (Experiment plan — no credit card, phone verification)

| Feature | Limit |
|---|---|
| Token budget | ~1B tokens/month |
| Rate limits | Evaluation-level (lower RPM) |
| Models | All models including Large and Codestral |
| Production use | Not allowed on free tier |

## Models & Pricing (paid)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context |
|---|---|---|---|
| Mistral Large | $2.00 | $6.00 | 128K |
| Mistral Medium | $0.40 | $2.00 | 128K |
| Mistral Small | $0.20 | $0.60 | 128K |
| Codestral | $0.30 | $0.90 | 256K |

## Caveats

- Free tier explicitly for evaluation/prototyping — not production
- Phone number verification required
- Rate limits on free tier are intentionally low to prevent production use

## Uni Chat Plan

### Free tier users
- Offer Mistral Small as a free option
- Per-user limit: 15 req/hour, 100 req/day
- Good for users who want a non-US model option

### Pro tier users
- Unlock Mistral Large and Codestral
- Route through direct API

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/mistral/+server.ts`
- OpenAI-compatible API format
- Consider using OpenRouter instead if Mistral's free tier ToS doesn't allow product usage
