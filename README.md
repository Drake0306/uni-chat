# UniChat

A multi-model AI chat application that lets you talk to 20+ LLMs from a single interface — for free. Built with SvelteKit 2 and Svelte 5, deployed on Vercel. No login wall — guests get localStorage persistence, authenticated users get cloud sync via Supabase.

Live: https://uni-chat-sigma.vercel.app/

## Who Is This For

- **Developers** who want to compare model outputs without juggling 6 different chat UIs
- **Students & researchers** who need access to frontier models without paying per-token
- **Anyone** who wants a fast, clean AI chat that doesn't lock you into one provider

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 2, Svelte 5, Tailwind CSS 4 |
| UI Components | shadcn-svelte, bits-ui |
| Icons | Lucide Svelte + local SVGs (lobehub CDN) |
| Auth | Google SSO via Supabase Auth |
| Database | Supabase (PostgreSQL with RLS) |
| File Storage | Supabase Storage (signed URLs) |
| Markdown | unified + remark-gfm + remark-math + rehype-katex + shiki |
| PDF Parsing | PDF.js (lazy-loaded) |
| Deployment | Vercel |
| Language | TypeScript |

## Supported Providers

| Provider | Models | Cost |
|----------|--------|------|
| Gemini | Flash, Pro, Thinking | Free |
| OpenRouter | Llama, Mixtral, DeepSeek, Qwen + more | Free |
| Groq | Llama 4 Scout, Qwen3 32B, Compound | Free |
| Mistral | Pixtral, Mistral Large | Free |
| OpenAI | GPT-4o, o-series (gated) | Paid |
| Anthropic | Claude (stub, pending) | Paid |

## Features

- **Multi-model selector** — grouped by company, filterable, with capability badges (thinking, vision, tools, search, files, image gen)
- **Streaming responses** — all providers normalized to OpenAI SSE format
- **Thinking/reasoning display** — collapsible blocks with progress bar for chain-of-thought models
- **File attachments** — PDF and text extraction works on every model; image uploads for vision-capable models
- **Dual persistence** — authenticated users sync to Supabase; guests use localStorage (max 50 chats)
- **Chat migration** — sign in with existing local chats? Sync prompt lets you keep or discard them
- **Server-side response persistence** — stream is tee()'d; responses survive browser close
- **Markdown rendering** — GFM tables, math (KaTeX), syntax highlighting (shiki), copy/collapse code blocks
- **Command palette** — Cmd+K search across all chats
- **Rate limiting** — tiered per user (Guest/Free/Pro/Max) with rolling windows
- **PWA-ready** — service worker, manifest, touch icons

## Architecture

```
User sends message
        |
        v
ChatView builds payload (text + attachments + images)
        |
        v
POST /api/chat → validates auth + rate limit
        |
        v
Routes to provider: /api/providers/{gemini|openrouter|groq|mistral|...}
        |
        v
Provider normalizes request → forwards to LLM API
        |
        v
SSE stream back → tee() splits: one branch to client, one persists to DB
        |
        v
Client renders streaming markdown + thinking blocks
```

## How This Project Was Built

This project was developed using a structured AI-assisted workflow. I architected the system, defined the technical direction, and used Claude Code as an execution tool to build it out:

1. **System Design** — I designed the multi-provider architecture, the dual-persistence model (Supabase + localStorage fallback), the SSE normalization layer, and the rate-limiting tiers. Defined how providers would be abstracted so adding a new LLM is just a config entry + optional transformer.

2. **UI/UX Direction** — I specified the interface patterns: command palette for search, company-grouped model selector with capability badges, collapsible thinking blocks, no login wall with graceful degradation. Used shadcn-svelte as the component foundation and directed the component composition.

3. **Task Breakdown & Execution** — Broke the project into discrete story points (auth flow, chat persistence, file attachments, image uploads, streaming, markdown pipeline, rate limiting) and directed Claude Code through each one with clear architectural constraints.

4. **Code Review & Optimization** — After implementation, reviewed the full codebase. Caught and fixed: auth deadlocks (async callback inside Supabase's `_initialize()`), N+1 query patterns, reactivity feedback loops in Svelte 5's `$effect`, race conditions during chat creation, and tailwind-merge class conflicts.

5. **Provider Integration** — Guided the multi-provider setup: Gemini needed a full SSE transformer, Groq needed `reasoning_format: 'parsed'` for thinking models, OpenRouter/Mistral/Groq pass through OpenAI-format content arrays natively. Each provider's quirks were handled without leaking abstraction.

6. **Image Pipeline** — Designed the V2 attachment system: Supabase Storage with signed URLs, provider-specific handling (Gemini base64-inlines server-side for privacy, others pass signed URLs), per-model image caps, and gating logic.

## Tools Used

| Purpose | Tool |
|---------|------|
| AI Coding Agent | Claude Code — directed for implementation, code review, and bug fixes |
| Design System | shadcn-svelte — pre-built accessible components, customized with Tailwind |
| Icon Design | Lucide icon set + lobehub provider logos |
| Database Design | Supabase dashboard + SQL migrations with RLS policies |
| API Testing | Manual verification of all provider endpoints and edge cases |
| Type Safety | TypeScript strict mode + `svelte-check` as build gate |

## Getting Started

```bash
git clone git@github.com:Drake0306/uni-chat.git
cd uni-chat
npm install
cp .env.example .env    # fill in API keys and Supabase credentials
npm run dev             # http://localhost:5173
```

Required environment variables:

```
OPENROUTER_API_KEY=         # free, no credit card
GEMINI_API_KEY=             # free, no credit card
GROQ_API_KEY=               # free, no credit card
MISTRAL_API_KEY=            # free, phone verification
PUBLIC_SUPABASE_URL=        # your Supabase project URL
PUBLIC_SUPABASE_ANON_KEY=   # publishable anon key
SUPABASE_SERVICE_ROLE_KEY=  # secret, server-side only
BYPASS_RATE_LIMIT=true      # set true for local dev
```

Database setup: run migrations via `npx supabase db push` or manually in Supabase SQL Editor.

## License

This project is licensed under the [Business Source License 1.1](./LICENSE). You may view, modify, and learn from the code, but you may not provide it as a hosted service or use it to compete with the original product. The code converts to GPL v2.0 on 2030-01-01.

Copyright 2024 Abhinav Roy. All Rights Reserved.
