# Provider Integration Plan

Each provider has its own doc, its own API endpoint, its own rate limits. Nothing bunched together.

## Architecture

```
src/routes/api/providers/
  openrouter/+server.ts    ← backbone, 290+ models, single API
  gemini/+server.ts        ← direct Google, best free tier
  groq/+server.ts          ← direct Groq, fastest inference
  anthropic/+server.ts     ← direct Claude, paid only
  openai/+server.ts        ← direct OpenAI, paid only
  mistral/+server.ts       ← direct Mistral, generous free eval
  deepseek/+server.ts      ← direct DeepSeek, cheapest paid
  xai/+server.ts           ← direct Grok, paid only
  moonshot/+server.ts      ← direct Kimi, lower priority
  cohere/+server.ts        ← direct Cohere, lower priority
  perplexity/+server.ts    ← direct Perplexity, search-augmented, paid only
  qwen/+server.ts          ← direct DashScope, lower priority (use OpenRouter)
```

## Routing Strategy by Subscription Tier

### Free Tier (no login required)
| Model | Provider | Why |
|---|---|---|
| Gemini 2.5 Flash | Google Direct | Best free tier, no expiry, 250 req/day |
| Llama 3.3 70B | OpenRouter Free | GPT-4 level, free |
| Qwen3 Coder 480B | OpenRouter Free | Best free coding model |
| DeepSeek R1 | OpenRouter Free | Strong reasoning, free |
| Llama 3.3 70B (Fast) | Groq Direct | Speed showcase |

### Pro Tier ($X/mo)
| Model | Provider |
|---|---|
| All free models | Same as above |
| Claude Sonnet 4.6 | Anthropic Direct |
| Claude Haiku 4.5 | Anthropic Direct |
| GPT-4o / GPT-4.1 | OpenAI Direct |
| o4-mini | OpenAI Direct |
| Gemini 2.5 Pro | Google Direct |
| Mistral Large | Mistral Direct |
| Grok 4.1 Fast | xAI Direct |
| Sonar (search) | Perplexity Direct |

### Max Tier ($XX/mo)
| Model | Provider |
|---|---|
| All Pro models | Same as above |
| Claude Opus 4.7 | Anthropic Direct |
| o3 | OpenAI Direct |
| Grok 4 | xAI Direct |
| Sonar Pro | Perplexity Direct |

## Per-User Rate Limits (enforced by Uni Chat, not providers)

| Tier | Per Hour | Per Day |
|---|---|---|
| Free (no login) | 10 | 50 |
| Free (logged in) | 30 | 200 |
| Pro | 60 | 500 |
| Max | 120 | Unlimited |

## Implementation Priority

1. **OpenRouter** — covers everything, ship fast
2. **Google Gemini** — best free tier
3. **Groq** — speed differentiator
4. **Anthropic** — first premium provider
5. **OpenAI** — second premium provider
6. **Mistral** — free tier bonus
7. **xAI** — premium expansion
8. **DeepSeek** — cheap paid option
9. **Perplexity** — unique search feature
10. **Cohere / Moonshot / Qwen** — niche, lower priority

## Provider Docs

- [OpenRouter](./openrouter.md) — backbone, 290+ models
- [Google Gemini](./google-gemini.md) — best free tier
- [Groq](./groq.md) — fastest inference
- [Anthropic](./anthropic.md) — Claude, paid only
- [OpenAI](./openai.md) — GPT/o-series, paid only
- [Mistral](./mistral.md) — generous free eval tier
- [DeepSeek](./deepseek.md) — cheapest paid
- [xAI Grok](./xai-grok.md) — premium, good signup credits
- [Moonshot Kimi](./moonshot-kimi.md) — niche, long-context
- [Cohere](./cohere.md) — RAG specialist
- [Perplexity](./perplexity.md) — search-augmented
- [Qwen](./qwen.md) — strong open-weight, best via OpenRouter
