# URL-based chat routing — design

**Date:** 2026-04-26
**Status:** Approved, pending implementation plan

## Goal

Move from a single-page chat UI (everything at `/`) to URL-addressable chats at `/chat/[id]`, while preserving guest-mode functionality and adding a one-time sync prompt when a guest signs in with existing local chats.

## Route structure

```
src/routes/
  +layout.svelte         (unchanged — sidebar provider)
  +layout.ts             (unchanged — ssr=false)
  +page.svelte           thin wrapper: <ChatView chatId={undefined} />
  chat/
    [id]/
      +page.svelte       thin wrapper: <ChatView chatId={$page.params.id} />
```

Both pages render the same `ChatView` component from `src/lib/components/chat-view.svelte`. The current 619-line `src/routes/+page.svelte` becomes that component. Two thin route wrappers is simpler than one route with conditional param logic.

## URL semantics

- `/` — new-chat composer. No `chatId`, no DB row yet. Empty messages array.
- `/chat/<id>` — existing chat. Loaded via `chatStore.loadChat(id)`.
- Guests get URLs the same way (their IDs are localStorage-only; the URL won't share, but bookmark-on-this-device works). Uniform routing logic, no auth-conditional navigation.
- Non-existent / unauthorized chat ID → `goto('/', { replaceState: true })` silently. (ChatGPT-style.)

## ChatView component

**Props:** `chatId?: string`

**Behavior:**
- On mount or when `chatId` changes:
  - `undefined` → empty composer state
  - set → `chatStore.loadChat(chatId)`; redirect to `/` if not found

**State ownership change (critical):**
Today `+page.svelte` holds `let messages = $state<Message[]>([])` locally and `$effect`-syncs from the store. This loses in-flight streams during the new-chat → `/chat/<id>` navigation because the local array dies with the unmounting component.

Fix: ChatView reads `messages` directly from `chatStore.activeChat.messages`. Streaming mutations target the store array. Navigation is then seamless — the new ChatView instance mounts and reads the same in-flight message.

Verification needed during implementation: per CLAUDE.md, "Store getters on plain objects don't create reactive proxies." `chats.svelte.ts` may need to expose `activeChat` so `messages` is a `$state` proxy.

## New-chat → URL transition

User submits first message while on `/`:

1. `chatStore.createChat()` → returns new chat with id, sets `activeChat`
2. `chatStore.addMessage(chatId, userMsg)` (fire-and-forget)
3. `goto('/chat/' + chatId, { replaceState: true, noScroll: true })`
4. Stream assistant response, mutating `chatStore.activeChat.messages`
5. New ChatView mounts and renders the in-flight message without missing tokens

`replaceState: true` — back button shouldn't bounce between empty `/` and the chat just created.
`noScroll: true` — preserve scroll position across the transition.

## Sidebar / navigation behavior

- **New Chat button** → `goto('/')`
- **Existing chats** → real anchor `<a href="/chat/{id}">` so middle-click and cmd-click open in a new tab; SvelteKit still handles SPA navigation on regular click.
- **Browser back/forward** → free. Reactive `$page.params.id` re-triggers ChatView's load logic.
- **Delete active chat** → `goto('/', { replaceState: true })`

## Login sync prompt

When a guest signs in with chats in localStorage, prompt before migrating.

**Trigger:** in `auth.svelte.ts`, on `onAuthStateChange` `SIGNED_IN` event, after profile fetch resolves, synchronously check `localStorage.getItem('unichat_chats')`. If non-empty, set `pendingSyncDecision = true` in the auth store.

**UI:** A `<Dialog>` mounted in `+layout.svelte` (or a dedicated component), shown when `pendingSyncDecision` is true. Two buttons:
- **Sync to my account** → `chatStore.migrateLocalToSupabase()`, then clear `unichat_chats`, close dialog
- **Discard** → clear `unichat_chats`, close dialog

No "Don't ask again." The dialog only fires when localStorage has chats, so it won't re-prompt until the user signs out, accumulates new local chats as a guest, and signs back in.

**Deadlock avoidance:** per CLAUDE.md feedback, the auth callback stays synchronous. The localStorage check is sync (just sets the flag); the actual `migrateLocalToSupabase()` await happens later inside the dialog button handler, outside the auth callback context.

**Edge case — viewing `/chat/<local-id>` when login fires:**
- Sync chosen: verify `migrateLocalToSupabase()` preserves IDs. If yes, URL stays valid. If no, redirect to `/`.
- Discard chosen: `goto('/', { replaceState: true })` since the local chat is gone.

## Out of scope

- Sharing URLs across devices/users (would require server-rendered shareable chat snapshots — separate feature)
- "Don't ask again" preference for sync prompt
- URL shape changes for nested resources (folders, projects, etc.)
