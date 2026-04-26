# DeepSeek — Direct

**Role:** Ultra-cheap paid provider. Strong reasoning model (R1).

## Why Direct

- Cheapest token pricing of any major provider
- DeepSeek R1 is competitive with Claude/GPT on reasoning tasks
- No rate limits — they serve every request they can

## Integration

- **Endpoint:** `https://api.deepseek.com/v1/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible

## Free Tier

5M free tokens on signup (~$8.40 value). **Expires in 30 days.** No credit card required.

Also available free via OpenRouter (DeepSeek R1 :free variant).

## Models & Pricing

| Model | Input — Cache Hit (per 1M) | Input — Cache Miss (per 1M) | Output (per 1M) | Context |
|---|---|---|---|---|
| DeepSeek V4 Flash | $0.028 | $0.14 | $0.28 | 128K |
| DeepSeek R1 | $0.14 | $0.55 | $2.19 | 128K |
| DeepSeek V3 | $0.07 | $0.27 | $1.10 | 128K |

## Caveats

- China-based provider — potential regulatory/data concerns for some users
- Free tokens expire in 30 days
- Service can be slow during peak hours (China timezone)

## Uni Chat Plan

### Free tier users
- Route DeepSeek R1 through **OpenRouter free variant** (not direct)
- No direct DeepSeek integration needed for free tier

### Pro tier users
- Direct API for DeepSeek V4 Flash (cheapest option for high-volume)
- Good as a cost-effective "unlimited feel" model

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/deepseek/+server.ts`
- Only instantiate for paid tier users
- For free tier, use OpenRouter's free DeepSeek R1 variant instead
