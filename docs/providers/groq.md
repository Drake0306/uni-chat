# Groq (Direct)

**Role:** Speed-focused free tier. "Wow that's fast" first impression.

## Why Direct (not through OpenRouter)

- Fastest inference available — hardware-optimized LPU
- Free tier with no credit card and no expiry
- Great for Llama models where speed matters more than model choice

## Integration

- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`
- **Auth:** Bearer token (API key from console.groq.com)
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible — any OpenAI SDK works

## Free Tier (no credit card, no expiry)

| Limit | Value |
|---|---|
| Requests per minute | 30 |
| Tokens per minute | 6,000 |
| Requests per day | 14,400 |

Rate limits apply at the organization level, not per user.

## Available Models

| Model | Context | Speed |
|---|---|---|
| Llama 3.3 70B | 128K | ~315 tokens/sec |
| Llama 3.1 8B | 128K | ~750 tokens/sec |
| Mixtral 8x7B | 32K | ~480 tokens/sec |
| Gemma 2 9B | 8K | ~500 tokens/sec |

## Paid Tier (Developer — requires CC, no minimum spend)

- 10x rate limits
- 25% cheaper token pricing
- Same models

## Caveats

- 6,000 tokens/min is the real bottleneck — limits response length
- Rate limits are org-level, so all Uni Chat users share the same quota
- Need to carefully manage concurrent users

## Uni Chat Plan

### Free tier users
- Offer as "Fast" mode — Llama 3.3 70B on Groq
- Per-user limit: 10 req/hour (to share the org-level 30 RPM)
- Best for short, quick responses — not long-form content

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/groq/+server.ts`
- OpenAI-compatible, so same request/response format as OpenRouter
- Queue system needed — if 30 RPM org limit is hit, queue or fall back to OpenRouter
