# Cohere — Direct

**Role:** Specialized provider. Strong RAG and enterprise search capabilities.

## Integration

- **Endpoint:** `https://api.cohere.com/v2/chat`
- **Auth:** Bearer token
- **Streaming:** Supported (SSE)
- **SDK:** `cohere` npm package

## Free Tier (Trial key — auto-created on signup)

| Feature | Limit |
|---|---|
| API calls | 1,000/month across all endpoints |
| Chat RPM | 20 |
| Embed RPM | 5 |
| Credit card | Not required |
| Production use | Not allowed |

## Models & Pricing (paid)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Command R+ | $2.50 | $10.00 |
| Command R | $0.15 | $0.60 |
| Embed 4 (text) | $0.12 | — |
| Rerank 3.5 | $2.00 per 1K searches | — |

## Caveats

- Trial key is explicitly for testing — not production
- 1,000 calls/month is very low for a product
- Cohere's strength is RAG/enterprise, not general chat

## Uni Chat Plan

### Free tier users
- **No access.** Too few free calls to share across users.

### Pro tier users
- Offer Command R as a RAG-capable option
- Per-user limit: 30 req/hour

### Implementation
- Dedicated `+server.ts` at `src/routes/api/providers/cohere/+server.ts`
- Lower priority — implement after core providers
- Cohere's API format differs from OpenAI — needs adapter
