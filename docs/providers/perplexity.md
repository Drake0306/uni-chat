# Perplexity — Direct

**Role:** Search-augmented AI. Unique capability — grounded answers with citations.

## Integration

- **Endpoint:** `https://api.perplexity.ai/chat/completions`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** OpenAI-compatible

## Free Tier

**No free API tier.** Pay-as-you-go only. Pro subscribers get $5/mo in API credits but that's tied to a $20/mo subscription.

## Models & Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|---|---|---|---|
| Sonar Pro | $3.00 | $15.00 | Deep research with citations |
| Sonar | $1.00 | $1.00 | Quick search answers |
| Search API | $5/1K requests | — | Raw web results, no synthesis |

## Caveats

- No free API access at all
- Unique value prop is live web search — no other provider does this as well
- API usage is separate from Pro subscription "unlimited" chat

## Uni Chat Plan

### Free tier users
- **No access.**

### Pro tier users
- Offer Sonar as a "Search" mode — web-grounded answers with citations
- Per-user limit: 20 req/hour
- Differentiate from other models by highlighting the search capability

### Max tier users
- Access to Sonar Pro for deep research

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/perplexity/+server.ts`
- OpenAI-compatible API format
- Parse and display citation links in the chat UI
