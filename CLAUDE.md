# Uni Chat

AI-powered chat application built with SvelteKit and shadcn-svelte.

## Working rules (read every session)

- **Never hallucinate, never guess.** If you don't know what something does, **read the actual code** — don't infer from naming, don't assume framework behaviors are universal. When the user reports a bug, find the bug by reading the code, not by adding "defensive" patches on top of what you think might be wrong.
- **Don't add speculative fixes.** If you don't know the root cause, say so and ask for diagnostics (browser console, network tab, specific reproduction steps) before changing more code. Layered "this might help" patches make regressions worse.
- **Verify before claiming done.** `npm run check` is the build truth — if it passes, the build is fine. LSP/IDE diagnostic warnings can be stale (TypeScript LSP cache issues are known in this project — recurring false positives on `chatStore.todayChats`, `pinChat`, `searchChats`, etc., even when the file compiles cleanly).
- **Read consumers before refactoring a store/util.** Always grep for every callsite of a function/property before changing its signature.
- **For any reactive state question:** read `src/lib/stores/chats.svelte.ts` and the relevant `.svelte` component end-to-end before guessing.
- **No auto-commits / no auto-pushes.** User runs all git commands themselves.
- **Tailwind v4 + tailwind-merge has class-conflict edge cases.** When `cn()`-merged classes don't override base classes (e.g., positioning conflicts), bypass with a CSS rule using `:has()` selectors instead of fighting the merge order.

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
        gemini/+server.ts     ← Gemini (free); transforms Gemini SSE → OpenAI; thinking; image blocks → inline_data via server fetch + base64
        openrouter/+server.ts ← OpenRouter (free); passthrough; OpenAI content arrays flow through for vision
        groq/+server.ts       ← Groq (free); passthrough; vision works on Llama 4 via OpenAI content arrays
        mistral/+server.ts    ← Mistral (free); passthrough; Pixtral / Mistral Large eat OpenAI content arrays
        anthropic/+server.ts  ← stub (403, paid). When enabled, needs an image transformer (image_url → {type:'image', source:{...}})
        openai/+server.ts     ← real passthrough; gated on OPENAI_API_KEY + per-model enabled flag; reasoning_effort for o-series
        xai/+server.ts        ← stub (403, paid)
        deepseek/+server.ts   ← stub (403, paid)
        moonshot/+server.ts   ← stub (403, paid)
        cohere/+server.ts     ← stub (403, paid)
        perplexity/+server.ts ← stub (403, paid)
        qwen/+server.ts       ← stub (403, paid)
  lib/
    supabase.ts               ← browser Supabase client (createBrowserClient from @supabase/ssr)
    markdown.ts               ← unified pipeline (lazy-loaded: all deps dynamically imported on first use)
    file-extract.ts           ← client-side file → text (PDF.js for PDFs, File.text() for code/text), legacy parser, fence-collision-safe markdown helper
    image-storage.ts          ← Supabase Storage upload + 1-hour signed-URL helper for image attachments (V2)
    types.ts                  ← shared Message + Attachment (text/image union) + LLMContentBlock + Chat types
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

- **Companies group models; providers are surfaced as a chip.** The selector groups by parent company (Google, Meta, Anthropic, OpenAI, …) — that's the primary hierarchy. Each model has a `provider` field (`gemini | openrouter | groq | mistral | anthropic | openai | …`) shown as a small "via [Provider]" chip with logo in the description area, so users know which service hosts the inference. (`PROVIDERS` map in `models.ts` defines the provider → display-name + icon mapping.) Note: there's also a top-level "Groq" company for Groq-proprietary agentic models (Compound, Compound Mini).
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

## File Attachments

### Text / PDF (universal across providers)

- **Universal text path.** PDFs extract via PDF.js (lazy-loaded), text/code via `File.text()`. Extracted content lives on `Message.attachments[]` (separate from `Message.content`) and is folded into a single string at request time so every provider receives the existing `{ role, content: string }` shape.
- **Type shape** (`src/lib/types.ts`): `Attachment` is a discriminated union `TextAttachment | ImageAttachment` (V2). Backward compat: rows without `kind` are normalized to `kind:'text'` on read by `normalizeAttachments` in chats store.
- **LLM payload assembly.** In `chat-view.svelte`'s `buildMessagesPayload`: text attachments fold into the content string via `attachmentsToMarkdown`; images promote the content to an OpenAI-shape `LLMContentBlock[]` (see Images below). Attachments are NEVER folded into stored `content`.
- **Fence-collision safety.** `attachmentsToMarkdown` calls `safeFence(text)` — counts the longest backtick run in the body, uses a fence one longer. Required so attached `.md` files don't break the outer wrapper.
- **Capability gating.** Paperclip is **not** gated on `capabilities.files` — text/PDF works on every model. The `files` flag is reserved for native-document V2 (Anthropic / Mistral OCR shapes).
- **Limits** (`src/lib/file-extract.ts`): `MAX_FILE_BYTES = 25 MB` per file (source), `MAX_TOTAL_BYTES = 50 MB` cumulative, `MAX_EXTRACTED_CHARS_PER_FILE = 500_000` (~125K tokens) on extracted text.
- **Persistence** (migration `20260429160000_message_attachments.sql`): `attachments jsonb` column. `mapMessageRow` + `loadFromLocalStorage` apply `parseLegacyAttachments` for messages saved before the split (detects `📎 **filename**` + fenced-block format with dynamic fence backreference). Pure read-time transform — never rewrites the row.
- **Display:** user bubble shows `message.content` only; attachments render as compact chips below. Chip remove + desktop attach button are `disabled` while `isExtracting` to close the mid-extraction race.
- **PDF.js worker** is `import('pdfjs-dist/build/pdf.worker.mjs?url')`. The `pdfjsPromise` cache resets on rejection. Each `PDFDocumentProxy` is `destroy()`-ed in `finally`.

### Images (vision-capable models only — V2)

- **Stored in Supabase Storage**, not inline. Bucket `chat-attachments` (private). Path: `<user_id>/<chat_id>/<message_id>/<filename>`. RLS policies gate read/insert/delete by `(storage.foldername(name))[1] = auth.uid()`. Migration: `20260429180000_chat_attachments_storage.sql` (idempotent: `on conflict do nothing` + `drop policy if exists`).
- **Type:** `ImageAttachment = { kind:'image', name, mimeType, storagePath, width?, height? }`. We persist the path, never the URL.
- **Signed URLs** are 1-hour, regenerated per-read by `getSignedImageUrl` in `image-storage.ts`. In-memory cache refreshes ~1 min before expiry. Lazy-loaded in the bubble via `{#await getSignedImageUrl}`.
- **LLM payload** switches from string content to `LLMContentBlock[]` the moment any message in the request carries an image: `[{type:'text', text}, {type:'image_url', image_url:{url: signedUrl}}]`. Built in `chat-view.svelte`'s `buildMessagesPayload`.
- **Provider routes:** OpenRouter / Groq / Mistral / OpenAI accept content arrays natively — passthrough. Gemini transformer fetches each `image_url` server-side, base64-encodes, emits Gemini `inline_data` parts. Image fetch failures are logged and the image is silently dropped (lenient — better to send the rest than 500 the request).
- **Picker gating** (`getAttachmentAccept(supportsVision)` builds the `accept=`): images allowed only when `currentModel.capabilities.vision === true` AND authenticated AND not temp-mode. `handleFileSelect` enforces all three with distinct error messages per rejection class.
- **Per-message count caps.** App-wide: 10 files, 10 images. Per-model image cap via optional `Model.maxImagesPerMessage` (Groq Llama 4 = 5, Mistral Pixtral / Large = 8) — `imageCap = min(app cap, model cap)`. Attach button disables at file cap; rejected picks surface a per-class warning. Model switch that leaves the user over the new cap shows an inline `overImageCap` alert and disables Send until resolved (no silent drops).
- **Send-flow ordering matters.** `createChat` runs BEFORE image upload because the Storage path embeds `chat_id`; the user message id is pre-allocated so Storage path and DB row line up. Don't reorder.
- **Anthropic still pending.** When `anthropic/+server.ts` is un-stubbed, it needs its own image transformer (`image_url` → `{type:'image', source:{type:'url'|'base64', ...}}`).
- **Privacy caveat — signed URLs travel to third-party providers.** OpenRouter / OpenAI / Mistral / Groq receive the request body containing `image_url.url` (a Supabase signed URL valid for 1 h) and very likely log it. Anyone with access to those provider logs can fetch the image until the URL expires. Gemini avoids this — its transformer fetches and base64-inlines server-side. Acceptable trade-off for V1; if it matters, switch the OpenAI-shape providers to base64-inline too (extra server-side fetch + bandwidth) or shorten the URL TTL to ~5 min for the LLM hop.

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

## Model config (`src/lib/config/models.ts`)

- **Every Model entry must have a `provider` field** (typed `Provider`, one of 12 values). The `PROVIDERS` map maps each provider → `{ name, icon }` for the "via [Provider]" chip in the model selector.
- **Companies vs providers:** Companies group models in the selector (Google, Meta, Anthropic, OpenAI, …). The `provider` field tells you who hosts the inference. The same model can appear under one company with multiple provider entries (e.g., "Llama 3.3 70B" via OpenRouter AND "Llama 3.3 70B (Fast)" via Groq are two separate model entries under Meta).
- **Adding a new model — checklist:**
  1. Add a `Model` entry under the right company in `models.ts`. Required: `id`, `name`, `icon`, `capabilities` (via `caps({...})`), `contextWindow`, `free`, `enabled`, `provider`, `route`, `apiModelId`. Editorial: `description`, `longDescription`, `developer`, `addedOn`, `priceTier` (paid only), `byok` (BYOK-only). Preview/evaluation models: add a code comment. (The Fast/Low/Med/High effort picker shows automatically whenever `capabilities.thinking === true`.)
  2. **`aaSlug`** — Artificial Analysis URL slug. Verify by visiting `https://artificialanalysis.ai/models/<slug>`. Powers the benchmark cards on the detail page. Leave undefined if AA doesn't track it.
  3. **`modelsDevId`** — id on models.dev. Find with `curl -s https://models.dev/api.json | grep -i <name>`. Drives the augmentation pulled by `npm run sync-models`.
  4. **Run `npm run sync-models`.** Writes `src/lib/config/models-augmentation.generated.ts` (committed). Reports unresolved `modelsDevId`s. The merger at the bottom of `models.ts` auto-populates `contextWindow` and `knowledgeCutoff` from the augmentation at module load.
  5. Add the model's `id` to `DEFAULT_RECOMMENDED` if it should be starred for new users by default.
  6. `npm run check`. Commit `models.ts` + `models-augmentation.generated.ts`.
- **Augmentation overrides** (`sync-models` from models.dev): `contextWindow`, `knowledgeCutoff`, and `capabilities.{vision, thinking, tools, files}`. Hardcoded values are fallback when augmentation has no data. `capabilities.{webSearch, imageGeneration}` stay editorial — models.dev doesn't track them reliably. So when adding a thinking model, **map `modelsDevId` to the thinking variant** (e.g., `kimi-k2-thinking`, not `kimi-k2-0905-preview`) — script reports show ↓ if a hardcoded `true` got overridden to `false`.
- **Disabled models stay in config** with `enabled: false` and a comment explaining why (e.g., Mixtral 8x7B was deprecated by Groq).
- **Adding new provider icons:** download from `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<slug>.svg` into `static/icons/`. Color variants (`<slug>-color.svg`) don't exist for all providers — fall back to mono SVGs which use `currentColor`.
- **Full background:** `docs/model-metadata-sources.md` (why hardcoded + augmentation), `docs/api-keys.md` (where every provider key comes from).

## Groq specifics

- **Live model list:** `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` is the canonical source. Don't trust the docs page alone; preview/deprecated models churn.
- **Catalog is narrow:** ~9 chat LLMs total. Don't expect breadth — Groq specializes in speed.
- **Compound (`groq/compound`, `groq/compound-mini`) is agentic.** It does web search + code execution natively. The current SSE parser in `chat-view.svelte` does NOT handle tool-call chunks — Compound output may render blank if the model invokes tools. Untested; known caveat. Plain LLMs (Llama, GPT-OSS, Qwen3-32B, Llama 4 Scout) work fine because they emit standard `delta.content`.
- **Mixtral 8x7B is deprecated** by Groq. Entry kept with `enabled: false` for traceability; do not re-enable without confirming Groq has restored it.
- **Preview models** (Llama 4 Scout, Qwen3 32B as of 2026-04-27) are explicitly evaluation-only per Groq's TOS — won't move to production tier with the model unchanged. OK for dev.

## Common pitfalls (regressions to NOT reintroduce)

- **`chatStore.createChat` MUST await the Supabase chat-row insert.** A previous "optimistic fire-and-forget" version caused `addMessage(user)` to FK-violate (chat row didn't exist yet) → user message lost on refresh, title stayed "New Chat". Optimistic UI (`todayChats = [chat, ...todayChats]`) runs synchronously *before* the await, so sidebar still updates instantly.
- **`chatStore.updateChatTitle` MUST NOT touch `updated_at`.** Renaming/regenerating is metadata, not activity. Bumping `updated_at` would re-bucket old chats into "Today" on refresh.
- **ChatView's load-chat `$effect` MUST track `authStore.loading`.** On fresh page loads (`/chat/<id>` directly, new tab, refresh), Supabase auth fires async after component mount. Without the `authLoading` guard, `useSupabase()` returns false → `loadChat` falls through to localStorage → not found → goto('/'). User loses the chat URL.
- **`$effect` reactivity on store-owned arrays:** wrap reads of `chatStore.activeChat` in `untrack()` inside the route-load effect to avoid feedback loops with `createChat`.
- **`chatStore.streaming` flag** prevents the polling effect from clobbering an in-flight stream during `goto('/chat/<id>')` navigation. Set in handleSend around the fetch.
- **Temp chat mode skips ALL persistence:** `createChat`, `addMessage`, `updateChatTitle`, sending `chatId/messageId` in the API body (which gates server-side tee), and the localStorage save in `finally`. Refresh wipes everything.
- **bits-ui `Command.Dialog`'s `value` prop binds to the highlighted item, NOT the input text.** To get the search query, `bind:value` on `Command.Input`, not on `Command.Dialog`. Doing it wrong causes an infinite loop because cmdk's selection state syncs back into the search query.
- **`for...of` on a `$state` proxy inside `$derived.by` can have tracking edge cases.** Prefer plain `.filter()` / indexed `for` loops with explicit `.length` reads.
- **Don't fold attachments into `Message.content`.** A previous version of the composer concatenated extracted file text into the message body (`fullText = text + "\n\n" + attachmentsToMarkdown(...)`), which dumped 50 KB of fenced PDF into the user's bubble, polluted Copy, and made Auto-title see file content. The current contract is: `content` = typed text only, `attachments` = structured array, recombined ONLY at fetch time inside `messages.map`. The legacy parser exists to migrate older rows on read; don't write that shape back.
- **Don't gate the paperclip on `capabilities.files`.** The text/PDF path is universal — every provider eats plain text. The capability flag is reserved for native-document V2.
- **Don't upload images before `createChat`.** The Storage path embeds `chat_id`; uploading before the chat row exists writes to a phantom path the DB will never reference. handleSend's order is: extract text → createChat → pre-allocate userMsgId → upload images (path uses that id) → push userMsg → fetch.
- **Reasoning is split via THREE mechanisms — keep all of them.** (1) Groq passthrough sends `reasoning_format: 'parsed'` when thinking is on (default is `'raw'` which inlines `<think>…</think>` for Qwen3-32B and GPT-OSS); (2) client + server SSE parsers accept BOTH `delta.reasoning_content` and `delta.reasoning` (Gemini emits the former, Groq/OpenRouter the latter); (3) `ThinkTagStripper` (`src/lib/think-tag-stripper.ts`) is a streaming-safe defensive parser that strips inline `<think>…</think>` from `delta.content` and routes them to reasoning — it must run in BOTH `chat-view.svelte` and `stream-persist.ts`'s `parseSSE` so live UI and persisted rows match. Removing any of these makes thinking leak into the visible answer for one provider or another.
- **Don't use shadcn `Dialog.Content` for an image lightbox.** Its defaults (`grid gap-4 p-4`, `sm:max-w-sm`, `ring-1`) keep clamping the dialog narrow and offsetting the image, even with overrides; tailwind-merge keeps the responsive `sm:max-w-sm` alongside any base `max-w` you pass. The image modal in `chat-view.svelte` is intentionally a hand-rolled `fixed inset-0 flex items-center justify-center` overlay with svelte/transition `fade` + `scale` for GPU-composited 60 FPS. Don't migrate it back to `Dialog.Content`.
- **User-bubble attachments render as TWO separate rows** — text/PDF chips first, image thumbnails second. Don't merge them into a single `flex-wrap` row: filename pills wrap awkwardly between thumbnails. Chips are borderless `bg-muted/70 px-1.5 py-0.5 text-[11px]` pills (lighter than the bordered staging chip on purpose, so they read as metadata under the bubble rather than another bordered card).

## Production / TOS notes

- **Free tiers (Groq Developer, OpenRouter `:free`, Gemini free tier) are dev-only.** Commercial deployment at scale violates TOS — switch to paid plans (Groq On-Demand, OpenRouter paid routes, Gemini billed) before launch. Same code, different API keys.
- **Always verify TOS directly with the provider** before launching a paid product on top of their inference.

