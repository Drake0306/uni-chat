# Google Gemini (Direct)

**Role:** Primary free tier model. Direct integration for the best free limits.

## Why Direct (not through OpenRouter)

- Google's free tier is the most generous and has no expiry
- No credit card required — just a Google account
- Higher rate limits than OpenRouter's free tier
- Full access to 1M token context window on free tier

## Integration

- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Auth:** API key (from Google AI Studio)
- **Streaming:** Supported (SSE via `streamGenerateContent`)
- **SDK:** `@google/generative-ai` npm package

## Free Tier (no credit card, no expiry)

| Model | RPM | Daily Requests | Tokens/Min |
|---|---|---|---|
| Gemini 2.5 Pro | 5 | 100 | 250,000 |
| Gemini 2.5 Flash | 10 | 250 | 250,000 |
| Gemini 2.5 Flash-Lite | 15 | 1,000 | 250,000 |

All models get the full 1M token context window on free tier.

## Paid Tier (Blaze plan — pay as you go)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Gemini 2.5 Pro | $1.25 (<=200K) / $2.50 (>200K) | $10.00 |
| Gemini 2.5 Flash | $0.15 | $0.60 |
| Gemini 2.5 Flash-Lite | $0.075 | $0.30 |

## Caveats

- Free tier data may be used to improve Google products
- Must display appropriate attribution per Google's ToS
- Rate limits are per-project (per API key), not per end-user

## Uni Chat Plan

### Free tier users
- **Default model:** Gemini 2.5 Flash (best balance of speed and quality)
- Per-user limit: 20 req/hour, 100 req/day
- Use multiple API keys to pool quotas if needed
- Fall back to Flash-Lite if Flash quota exhausted

### Paid tier users
- Unlock Gemini 2.5 Pro access
- Route through direct API (cheaper than OpenRouter's 5% markup)
- Consider Blaze plan for higher limits

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/gemini/+server.ts`
- Separate from OpenRouter — direct Google SDK integration
- Track per-user usage for internal rate limiting (Google limits are per-key, not per-user)
