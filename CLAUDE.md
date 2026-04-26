# Uni Chat

AI-powered chat application built with SvelteKit and shadcn-svelte.

## Stack

- **Language:** TypeScript
- **Package Manager:** npm
- **Framework:** SvelteKit
- **UI Library:** shadcn-svelte (https://www.shadcn-svelte.com/docs/components)
- **Styling:** TailwindCSS v4
- **Icons:** @lucide/svelte + local SVGs in `/static/icons/` (downloaded from lobehub CDN)
- **Auth:** Google SSO via Supabase Auth
- **Database:** Supabase (PostgreSQL with RLS)
- **Markdown:** unified + remark-gfm + remark-math + rehype-katex + shiki (lazy-loaded)

## Architecture

- **Client-side rendering only.** `src/routes/+layout.ts` exports `ssr = false`.
- **Chat page is the home page.** No separate landing page.
- **No login wall.** Auth enhances but doesn't gate. Guest users get localStorage persistence.
- **URL-addressable chats.** `/` is the empty composer; `/chat/[id]` loads a specific chat. Both routes render `<ChatView chatId={...} />` (extracted to `src/lib/components/chat-view.svelte`).
- **SvelteKit API routes for backend.** `src/routes/api/` with `+server.ts` files.
- **Dual persistence:** Authenticated users → Supabase. Guests → localStorage. Falls back to localStorage if Supabase tables don't exist.

## Project Structure

```
src/
  routes/
    +layout.svelte            ← sidebar provider + sync-prompt-dialog mount
    +layout.ts                ← ssr = false
    +page.svelte              ← thin wrapper: <ChatView /> (no chatId)
    chat/[id]/+page.svelte    ← thin wrapper: <ChatView chatId={page.params.id} />
    api/
      chat/+server.ts         ← unified router: validates, rate-limits, forwards to provider, tee() saves response server-side
      providers/
        gemini/+server.ts     ← Google Gemini (free, transforms Gemini SSE → OpenAI format, thinking support)
        openrouter/+server.ts ← OpenRouter (free, passthrough)
        groq/+server.ts       ← Groq (free, passthrough)
        mistral/+server.ts    ← Mistral (free, passthrough)
        anthropic/+server.ts  ← stub (403, paid)
        openai/+server.ts     ← stub (403, paid)
        xai/+server.ts        ← stub (403, paid)
        deepseek/+server.ts   ← stub (403, paid)
        moonshot/+server.ts   ← stub (403, paid)
        cohere/+server.ts     ← stub (403, paid)
        perplexity/+server.ts ← stub (403, paid)
        qwen/+server.ts       ← stub (403, paid)
  lib/
    supabase.ts               ← browser Supabase client (createBrowserClient from @supabase/ssr)
    markdown.ts               ← unified pipeline (lazy-loaded: all deps dynamically imported on first use)
    types.ts                  ← shared Message + Chat types
    config/
      models.ts               ← SINGLE SOURCE OF TRUTH for companies, models, routes, typed capabilities
    server/
      supabase.ts             ← server-side auth validation (getAuthUser) + service client singleton
      rate-limit.ts           ← per-key rate limiter (guest/free/pro/max tiers, 4h rolling window)
      stream-persist.ts       ← SSE parser + server-side response accumulation and DB save
    stores/
      auth.svelte.ts          ← reactive auth state (Google SSO, tier, user profile)
      chats.svelte.ts         ← dual-backend chat persistence (Supabase + localStorage fallback)
      command.svelte.ts       ← command palette open state
    components/
      ui/                     ← shadcn-svelte (do not edit)
      app-sidebar.svelte      ← sidebar: new chat, search (Cmd+K), chat history, auth footer
      chat-view.svelte        ← main chat UI; takes optional chatId prop, used by both routes
      sync-prompt-dialog.svelte ← post-login dialog: sync localStorage chats to account or discard
      model-selector.svelte   ← popover model picker (company sidebar + model grid + capability badges)
      markdown-renderer.svelte ← renders markdown with code blocks (copy/collapse), tables (copy), math (KaTeX)
      thinking-block.svelte   ← collapsible thinking/reasoning display with progress bar
      google-icon.svelte      ← Google logo SVG for sign-in button
    utils.ts
  app.css                     ← imports: tailwind, shadcn, inter, katex, typography plugin
static/
  icons/                      ← local model/company SVG icons (no CDN dependency)
docs/
  models.md                   ← single-table model reference (all models, rate limits, capabilities)
  providers/                  ← per-provider research docs
supabase/
  migrations/                 ← SQL migrations (profiles, chats, messages tables with RLS)
```

## Key Design Decisions

- **Companies, not providers.** The user sees parent companies (Google, Meta, Anthropic). Internal routing providers (OpenRouter, Groq) are invisible.
- **models.ts is the config hub.** Each model has `route` (internal API path) and `apiModelId` (what to send to the provider). Flip `enabled` to toggle models. Flip `free` to mark pricing.
- **All streaming is normalized to OpenAI SSE format.** Gemini's provider transforms its response. Others are passthrough. Thinking models emit `delta.reasoning_content` alongside `delta.content`.
- **Typed capabilities drive the UI.** `ModelCapabilities` object (thinking/vision/tools/webSearch/files/imageGeneration) controls badges in the selector and toolbar buttons in the composer.
- **Capability badges are color-coded.** Thinking=violet, Vision=blue, Tools=orange, Search=teal, Files=pink, Image=rose.

## Environment Variables (.env / .env.example)

```
OPENROUTER_API_KEY=              # free, no CC
GEMINI_API_KEY=                  # free, no CC
GROQ_API_KEY=                    # free, no CC
MISTRAL_API_KEY=                 # free, phone verify
PUBLIC_SUPABASE_URL=             # https://<project>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=        # publishable/anon key
SUPABASE_SERVICE_ROLE_KEY=       # secret key (server-side only)
BYPASS_RATE_LIMIT=true           # set "true" in dev to skip internal rate limiting
```

## Installed shadcn-svelte Components

avatar, badge, button, command, dialog, dropdown-menu, input, popover, scroll-area, separator, sheet, sidebar, skeleton, textarea, toggle-group, tooltip

## Svelte 5 Reactivity Patterns

- **Messages live in `chatStore`, not in components.** ChatView reads via `const messages = $derived(chatStore.messages)`. Streaming mutations target `chatStore.lastMessage()!` so they survive the new-chat → `/chat/<id>` navigation (the old component unmounts but the store object persists, and the new component sees the same proxy).
- **Cross-navigation flags belong in the store, not in components.** `chatStore.streaming` (set around the fetch in `handleSend`) is read by the polling `$effect` to avoid `loadChat` clobbering an in-flight stream. Component-local `loading` is reset on remount.
- **Use `untrack()` in `$effect` to prevent feedback loops.** The `$effect` at the top of `chat-view.svelte` reads `chatStore.activeChat` for routing decisions but must NOT re-run when `activeChat` changes (otherwise `createChat` would trigger `clearActive`). Wrap the body in `untrack(...)` so only `chatId` (the prop) is tracked.
- **Store getters on plain objects** don't create reactive proxies. For mutable arrays use reassignment (`messages = [...messages, msg]`) not `push()`. For object-property mutations on items inside a `$state` array, the elements become deeply reactive automatically.
- **Don't `await` persistence during streaming.** Fire-and-forget `chatStore.addMessage()` calls so the UI doesn't block.

## Routing

- `/` → `<ChatView />` (no chatId). Empty composer state.
- `/chat/[id]` → `<ChatView chatId={page.params.id} />` (use `$app/state`, NOT deprecated `$app/stores`).
- New chat: at `/`, after first message creates the chat, `goto('/chat/<id>', { replaceState: true, noScroll: true })` happens AFTER `pushMessage` calls so the new component mounts with messages already in the store.
- Sidebar chat items are real `<a href="/chat/{id}">` anchors (cmd-click → new tab).
- Delete-active-chat → `goto('/', { replaceState: true })`.

## Auth Flow

- Google SSO via Supabase Auth (`@supabase/ssr` with `createBrowserClient`, CSR mode)
- **CRITICAL: `onAuthStateChange` callback must NOT be async or await Supabase client calls.** The auth client awaits callbacks inside `_initialize()` — awaiting `getSession()` there creates a deadlock via `initializePromise`. Use `.then()` (fire-and-forget) instead.
- `src/lib/stores/auth.svelte.ts` listens to `onAuthStateChange` for all events
- API routes validate JWT via `getAuthUser(request)` using the service client
- Rate limiting: guests by IP, authenticated users by user_id with tier from profiles table
- Sidebar shows Google sign-in button (guest) or avatar + name + tier + dropdown (authenticated)
- `DropdownMenu.Item` uses `onSelect` not `onclick` (bits-ui convention)

## Chat Persistence

- **Authenticated:** Supabase PostgreSQL (chats + messages tables with RLS)
- **Guest:** localStorage (`unichat_chats` key, max 50 chats)
- **Fallback:** If Supabase tables don't exist, `supabaseAvailable` flag disables DB queries and falls back to localStorage even when authenticated
- **Migration:** When a guest signs in with chats in localStorage, a sync prompt dialog (`sync-prompt-dialog.svelte`, mounted in `+layout.svelte`) appears. "Sync to my account" calls `chatStore.migrateLocalToSupabase()` (note: regenerates IDs, so the URL is reset to `/`). "Discard" clears `unichat_chats` from localStorage. Triggered by `authStore.pendingSyncDecision` flag, set synchronously inside `onAuthStateChange` on `SIGNED_IN`.
- **Server-side response persistence:** `/api/chat` uses `tee()` to split the LLM stream — one branch streams to client, the other accumulates and saves to Supabase via service client. Responses survive browser refresh/close. Client sends `chatId` + `messageId` in the request body (authenticated users only). Server creates an empty assistant message row immediately, updates with full content when stream completes. Client polls every 3s for pending responses.
- **Browser Supabase client uses `cache: 'no-store'`** to prevent stale query results on refresh.

## Rate Limiting

`src/lib/server/rate-limit.ts` — keyed by user_id (authenticated) or IP (guest). 4 tiers with rolling windows:

| Tier | Per 4h | Per Day | Per Month |
|---|---|---|---|
| Guest | 3 | 8 | — |
| Free | 5 | 15 | — |
| Pro | 25 | 150 | 1,000 |
| Max | 60 | 400 | 3,000 |

Set `BYPASS_RATE_LIMIT=true` in `.env` for development.

## Database Setup Required

Run SQL migrations in Supabase SQL Editor (or via CLI: `npx supabase login && npx supabase link && npx supabase db push`). Files in `supabase/migrations/`. Tables: profiles (auto-created on signup via trigger), chats, messages. All have RLS policies.

## Known Issues / Pending Work

- **Error messages from failed API calls are excluded from conversation history** via `isError` flag on Message type.
- **Server-side persistence limitation:** If the server process dies mid-stream (deploy, crash), the in-flight response is lost. See `docs/response-persistence.md` for the job queue upgrade path.

Provider research docs are in `docs/providers/`. Full model reference table at `docs/models.md`. Setup guide at `SETUP.md`.
