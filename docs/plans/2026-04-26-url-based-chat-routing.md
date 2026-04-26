# URL-based chat routing — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/chat/[id]` URL-addressable chats with extracted `ChatView` component, plus a one-time sync prompt for guests-turned-authenticated users.

**Architecture:** Two thin route files (`/+page.svelte` and `/chat/[id]/+page.svelte`) both render the same `ChatView` component with a `chatId?: string` prop. State ownership moves into `chatStore` so streaming survives the new-chat → `/chat/<id>` navigation. Login sync prompt is a dialog driven by a flag on `authStore`.

**Tech Stack:** SvelteKit 2 (CSR), Svelte 5 ($state/$effect/$derived), shadcn-svelte (Dialog), `$app/navigation` (`goto`), `$app/stores` (`page`).

**Design doc:** `docs/plans/2026-04-26-url-based-chat-routing-design.md`

**Verification:** No test framework exists. Each phase ends with `npm run check` (svelte-check + tsc) and explicit manual browser steps. UI correctness must be verified in the browser, not from type-checking alone.

**Commit policy:** User has a standing "no auto-commits" rule. Do **not** run `git commit` between phases unless explicitly approved. Stage changes for review only.

---

## Phase 0 — Reactivity sanity check

Before refactoring state ownership, confirm Svelte 5 reactivity works on `chatStore.messages` for streaming mutations.

### Task 0.1: Spike — verify store-array mutation triggers re-render

**Files:**
- Read only: `src/lib/stores/chats.svelte.ts` (lines 10, 88-90 — `messages` is `$state<Message[]>([])` exposed via getter)

**Step 1:** Confirm `messages` is declared at module scope as `let messages = $state<Message[]>([])` (line 10) and exposed via `get messages()` getter (line 88).

**Step 2:** Confirm CLAUDE.md guidance: "Store getters on plain objects don't create reactive proxies. For mutable arrays that need reactivity, use reassignment (`messages = [...messages, msg]`) not `push()`."

**Step 3:** Decide pattern:
- Reads in component: `chatStore.messages` directly (works, getter returns the `$state` proxy).
- Push: use existing `chatStore.pushMessage(msg)` which does `messages = [...messages, msg]` (line 93-95). Already correct.
- Streaming append (mutate last message's content): the message **object** is a reactive proxy because it's inside the `$state` array, so `chatStore.messages[chatStore.messages.length - 1].content += chunk` works. Use `chatStore.lastMessage()` (line 98) to grab a stable reference.

**Step 4:** No code changes in this task. Document the verified pattern as a comment at the top of `chats.svelte.ts` for future-you. Skip if a comment isn't warranted.

**Outcome:** Confirmation that the refactor in Phase 2 is safe.

---

## Phase 1 — Extract ChatView component (no behavior changes)

Mechanical extraction first. Same behavior, new home.

### Task 1.1: Create ChatView component as a copy of +page.svelte

**Files:**
- Create: `src/lib/components/chat-view.svelte`
- (No modifications yet)

**Step 1:** Copy the entire contents of `src/routes/+page.svelte` to `src/lib/components/chat-view.svelte`.

**Step 2:** At the top of the new component's `<script lang="ts">`, add a props declaration:

```ts
let { chatId }: { chatId?: string } = $props();
```

For now, `chatId` is unused — Phase 3 wires it up.

**Step 3:** Run `npm run check`. Expected: PASS (component is self-contained, imports unchanged).

### Task 1.2: Replace +page.svelte with thin wrapper

**Files:**
- Modify: `src/routes/+page.svelte` (replace entire contents)

**Step 1:** Replace `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
	import ChatView from '$lib/components/chat-view.svelte';
</script>

<ChatView />
```

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify: `npm run dev`, visit `/`, confirm chat UI renders identically. Send one message, confirm streaming works.

---

## Phase 2 — State ownership refactor (foundation for seamless nav)

Move `messages` state from ChatView local to `chatStore`. This is required before adding navigation, otherwise streaming dies on the unmount.

### Task 2.1: Remove local `messages` state in ChatView

**Files:**
- Modify: `src/lib/components/chat-view.svelte`

**Step 1:** Delete the local `let messages = $state<Message[]>([])` declaration (currently around line 56).

**Step 2:** Delete the syncing `$effect`:

```ts
$effect(() => {
    messages = chatStore.messages;
});
```

**Step 3:** Replace all reads of `messages` in the component with `chatStore.messages`. Use a `$derived` alias near the top of `<script>` for terseness:

```ts
const messages = $derived(chatStore.messages);
```

This keeps the existing `messages` references in markup and effects working unchanged. `$derived` re-runs when `chatStore.messages` changes, which is when `pushMessage` reassigns it.

**Step 4:** Replace `messages.push(userMsg)` and `messages.push({...assistantMsg})` in `handleSend` with:

```ts
chatStore.pushMessage(userMsg);
// ...
chatStore.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    modelName: selectedModel.modelName,
});
const assistantMsg = chatStore.lastMessage()!;
```

The `assistantMsg` reference now points to the object inside the store array. Streaming mutations like `assistantMsg.content += chunk` work because the object is a `$state` proxy.

**Step 5:** Run `npm run check`. Expected: PASS.

**Step 6:** Manual verify: send a message, watch it stream. The streaming reactivity test is critical here — if tokens appear all at once at the end (instead of incrementally), reactivity is broken on store-owned objects and we need to revisit.

### Task 2.2: Verify scroll effect still triggers

**Files:**
- Modify: `src/lib/components/chat-view.svelte` (only if needed)

**Step 1:** The scroll-to-bottom `$effect` (around line 136) reads `messages[messages.length - 1].content`. With `$derived(chatStore.messages)`, this should still subscribe correctly. Verify by sending a long streaming message — page should auto-scroll.

**Step 2:** If scroll doesn't trigger, the `$effect` may need `chatStore.lastMessage()?.content` as the explicit dependency. Adjust if needed.

---

## Phase 3 — Add /chat/[id] route + load behavior

Now wire up the URL.

### Task 3.1: Create /chat/[id] route

**Files:**
- Create: `src/routes/chat/[id]/+page.svelte`

**Step 1:** Create the file with:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import ChatView from '$lib/components/chat-view.svelte';
</script>

<ChatView chatId={$page.params.id} />
```

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify: with `npm run dev` running, manually create a chat at `/`, copy its id from the sidebar, visit `/chat/<that-id>` directly. Page should render with the chat loaded — but it won't yet, because Task 3.2 implements the load.

### Task 3.2: Implement load-on-prop-change in ChatView

**Files:**
- Modify: `src/lib/components/chat-view.svelte`

**Step 1:** Add an effect that responds to `chatId` prop changes. Place it after the props declaration:

```ts
import { goto } from '$app/navigation';

$effect(() => {
    const id = chatId;
    if (!id) {
        // Empty composer state
        if (chatStore.activeChat) chatStore.clearActive();
        return;
    }
    if (chatStore.activeChat?.id === id) return; // already loaded
    chatStore.loadChat(id).then(() => {
        if (chatStore.activeChat?.id !== id) {
            // Not found — silently fall back to /
            goto('/', { replaceState: true });
        }
    });
});
```

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify:
- Create a chat at `/`, send a message.
- Click the sidebar item — currently calls `loadChat` imperatively, URL stays `/`. Don't worry about that yet — Phase 5 fixes the sidebar.
- Manually visit `/chat/<valid-id>` → loads correctly.
- Manually visit `/chat/nonexistent-id` → silently redirects to `/`.

---

## Phase 4 — New-chat → URL transition

Hook up the `goto` after first message creates a chat.

### Task 4.1: Navigate to /chat/<id> on first message

**Files:**
- Modify: `src/lib/components/chat-view.svelte` (the `handleSend` function)

**Step 1:** Inside `handleSend`, after the existing `chatId = await chatStore.createChat(...)` call (around line 163), add a goto:

```ts
let chatId = chatStore.activeChat?.id;
let isNewChat = false;
if (!chatId) {
    try {
        chatId = await chatStore.createChat(selectedModel.modelId, selectedModel.companyId);
        isNewChat = true;
    } catch (err) {
        console.error('Failed to create chat:', err);
        return;
    }
}
// ... existing pushMessage / loading=true / etc. ...

if (isNewChat) {
    // Navigate to the new chat's URL. replaceState avoids back-button bouncing
    // between empty / and the chat just created. noScroll preserves position.
    goto(`/chat/${chatId}`, { replaceState: true, noScroll: true });
}
```

**Position the `goto`** after `chatStore.pushMessage(userMsg)` and `pushMessage(assistantMsg)` so the new ChatView mount sees both in the store immediately. Streaming mutations target `assistantMsg` (already a store-owned proxy reference), so the unmount/remount during navigation does not lose tokens.

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify (the critical test):
- Visit `/` while logged out (guest). Send a message.
- URL should change to `/chat/<some-uuid>`.
- The streaming response should continue smoothly through the navigation — no flash, no missing tokens.
- Hit browser Back. You should NOT bounce back to empty `/` (because `replaceState`).
- Repeat while logged in.

**If streaming tokens go missing during navigation:** the suspect is the `assistantMsg` reference being detached from the new ChatView's view of the store. Fix is to read `chatStore.lastMessage()` again after `goto` — but only do this if you observe the bug.

---

## Phase 5 — Sidebar links + new-chat button

Switch the sidebar from imperative store calls to URL navigation.

### Task 5.1: Find sidebar callsites for new-chat and chat-select

**Files:**
- Read: `src/lib/components/app-sidebar.svelte`

**Step 1:** Grep for callers of `chatStore.clearActive()`, `chatStore.loadChat(`, and the sidebar's chat list rendering. Identify:
- "New Chat" button onClick
- Chat list item onClick
- The toolbar `+` button at line 319 of the old `+page.svelte` — now in `chat-view.svelte`

### Task 5.2: New-chat button → goto('/')

**Files:**
- Modify: `src/lib/components/app-sidebar.svelte`
- Modify: `src/lib/components/chat-view.svelte` (the floating toolbar `+` button)

**Step 1:** Replace `onclick={() => chatStore.clearActive()}` with `onclick={() => goto('/')}` for the New Chat button(s). Add `import { goto } from '$app/navigation';` if not already imported.

**Step 2:** Run `npm run check`. Expected: PASS.

### Task 5.3: Chat list items become real anchors

**Files:**
- Modify: `src/lib/components/app-sidebar.svelte`

**Step 1:** Find the chat list `{#each chats as chat}` block. The current pattern is likely a button with `onclick={() => chatStore.loadChat(chat.id)}`. Replace with an anchor:

```svelte
<a
    href="/chat/{chat.id}"
    class="..."
    {/* aria/active-state attributes preserved */}
>
    {chat.title}
</a>
```

The `$effect` in ChatView already handles the load on URL change, so no JS is needed on click.

**Step 2:** Active-state highlighting: derive from `$page.url.pathname === '/chat/' + chat.id`. Replace any `chatStore.activeChat?.id === chat.id` checks where appropriate (or keep both — they should agree once routing is the source of truth).

**Step 3:** Run `npm run check`. Expected: PASS.

**Step 4:** Manual verify:
- Click a chat in the sidebar → URL changes, chat loads.
- Cmd-click (Mac) / Ctrl-click → opens in new tab. This is the killer feature of using real anchors.
- Browser Back/Forward → switches between chats.

---

## Phase 6 — Delete-active-chat redirect

### Task 6.1: Redirect to / when deleting the active chat

**Files:**
- Modify: `src/lib/components/app-sidebar.svelte` (or wherever `chatStore.deleteChat` is called)

**Step 1:** Find the delete callsite. Wrap with a redirect check:

```ts
async function handleDelete(chatId: string) {
    const wasActive = $page.params.id === chatId;
    await chatStore.deleteChat(chatId);
    if (wasActive) goto('/', { replaceState: true });
}
```

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify: delete the currently-viewed chat → URL goes to `/`, empty composer appears.

---

## Phase 7 — Login sync prompt

### Task 7.1: Add pendingSyncDecision flag to authStore

**Files:**
- Modify: `src/lib/stores/auth.svelte.ts`

**Step 1:** Add a new state at the top:

```ts
let pendingSyncDecision = $state(false);
```

**Step 2:** Add a getter and a setter:

```ts
// in the exported authStore object:
get pendingSyncDecision() {
    return pendingSyncDecision;
},
clearSyncDecision() {
    pendingSyncDecision = false;
},
```

**Step 3:** In the `onAuthStateChange` callback, after setting `user = sess?.user ?? null`, add (synchronously — no await):

```ts
if (_event === 'SIGNED_IN' && user && typeof window !== 'undefined') {
    try {
        const raw = localStorage.getItem('unichat_chats');
        const arr = raw ? JSON.parse(raw) : [];
        if (Array.isArray(arr) && arr.length > 0) {
            pendingSyncDecision = true;
        }
    } catch {
        // Corrupt JSON — ignore, don't prompt
    }
}
```

**CRITICAL:** This block must remain synchronous. No `await`, no Supabase client calls. See lines 11-15 of the existing file for the deadlock explanation.

**Step 4:** Run `npm run check`. Expected: PASS.

### Task 7.2: Create the sync prompt dialog component

**Files:**
- Create: `src/lib/components/sync-prompt-dialog.svelte`

**Step 1:** Use shadcn-svelte Dialog. Skeleton:

```svelte
<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { chatStore } from '$lib/stores/chats.svelte.js';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';

    let busy = $state(false);

    async function sync() {
        busy = true;
        try {
            const localChatId = $page.params.id;
            await chatStore.migrateLocalToSupabase();
            // migrateLocalToSupabase generates new IDs, so any local-id URL is now stale.
            if (localChatId) goto('/', { replaceState: true });
        } finally {
            authStore.clearSyncDecision();
            busy = false;
        }
    }

    function discard() {
        const localChatId = $page.params.id;
        localStorage.removeItem('unichat_chats');
        chatStore.clearActive();
        chatStore.loadChats();
        authStore.clearSyncDecision();
        if (localChatId) goto('/', { replaceState: true });
    }
</script>

<Dialog.Root open={authStore.pendingSyncDecision}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Sync your chats?</Dialog.Title>
            <Dialog.Description>
                You have unsynced chats from before signing in. Would you like to add them to your account?
            </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="ghost" onclick={discard} disabled={busy}>Discard</Button>
            <Button onclick={sync} disabled={busy}>
                {busy ? 'Syncing...' : 'Sync to my account'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
```

**Note:** The dialog is non-dismissable (no close X, no backdrop click) — user must explicitly choose. shadcn Dialog supports this via `<Dialog.Content interactOutsideBehavior="ignore" escapeKeydownBehavior="ignore">` if needed; check current bits-ui version.

**Step 2:** Run `npm run check`. Expected: PASS.

### Task 7.3: Mount the dialog in +layout.svelte

**Files:**
- Modify: `src/routes/+layout.svelte`

**Step 1:** Import and render the dialog component once at the layout level so it's always available regardless of route:

```svelte
<script lang="ts">
    import SyncPromptDialog from '$lib/components/sync-prompt-dialog.svelte';
    // ... existing imports
</script>

<!-- existing layout content -->

<SyncPromptDialog />
```

**Step 2:** Run `npm run check`. Expected: PASS.

**Step 3:** Manual verify (the critical test for this phase):
- Sign out. Send 2-3 messages as a guest at `/` and on `/chat/<local-id>`.
- Sign in with Google.
- After auth completes: dialog should appear.
- Click "Sync to my account":
  - Wait for spinner.
  - Sidebar should refresh with the migrated chats (new IDs).
  - URL should redirect to `/`.
- Repeat the flow, but click "Discard":
  - localStorage `unichat_chats` should be empty (DevTools → Application → Local Storage).
  - Sidebar shows no chats.
  - URL redirects to `/`.

---

## Phase 8 — Final checks

### Task 8.1: Type-check

**Step 1:** Run `npm run check`. Expected: PASS with zero errors.

### Task 8.2: Manual smoke test matrix

Run through this list explicitly and report results:

1. **Guest, fresh browser, /** — empty composer, suggestions visible.
2. **Guest sends first message at /** — URL becomes `/chat/<id>`, response streams without dropping tokens.
3. **Guest reloads /chat/<id>** — chat reloads from localStorage.
4. **Guest visits /chat/<bogus-id>** — silently redirects to /.
5. **Guest clicks sidebar chat item** — URL changes, chat loads.
6. **Guest cmd-clicks sidebar item** — opens in new tab.
7. **Browser back/forward across two chats** — switches correctly.
8. **Guest deletes active chat** — URL → /.
9. **Guest signs in with localStorage chats** — sync prompt appears.
10. **"Sync" button** — chats migrated, sidebar refreshes, URL → /.
11. **"Discard" button** — localStorage cleared, sidebar empty.
12. **Authenticated user same flow as 1-8** — all behaviors identical.
13. **In-flight stream + page navigation** — start a long generation, immediately Back. Either the stream continues in background and the message saves server-side (auth users) or it's interrupted gracefully (guests). Verify no console errors.

### Task 8.3: Update CLAUDE.md and memory

**Files:**
- Modify: `CLAUDE.md` — update the "Known Issues / Pending Work" section to remove URL routing and add any new findings.
- Update memory: project_current_state.md — mark URL routing complete.

**Step 1:** Edit `CLAUDE.md`:

- Under "Project Structure", update the `routes/` tree to include `chat/[id]/+page.svelte`.
- Under "Known Issues / Pending Work", remove the "URL-based chat routing not implemented" bullet.
- Under "Architecture", add a note about the route shape.

**Step 2:** Update memory file `project_current_state.md` to reflect URL routing as completed and remove from pending list.

---

## Risk register

- **Streaming reactivity on store-owned objects** (Phase 2). Mitigation: Phase 0 spike confirms the pattern. If it still breaks, revert to local `messages` and use a layout-level component to avoid unmount.
- **`migrateLocalToSupabase` regenerates IDs** (Phase 7). Confirmed by reading current code (line 287-321 of `chats.svelte.ts`). The dialog's redirect to `/` after Sync is the correct behavior.
- **`onAuthStateChange` fires on every TOKEN_REFRESHED** (every hour). The `_event === 'SIGNED_IN'` guard ensures the prompt only appears on actual sign-in, not refresh. Verify `_event` values match Supabase's contract.
- **Dialog over a streaming chat** if user signs in mid-stream is unlikely but possible. Existing dialog modal will block interaction; stream completes regardless. No special handling needed.

---

## Out of scope

- Sharing URLs across devices (would require unguessable IDs + server-rendered shareable snapshots — separate feature).
- "Don't ask again" preference for the sync prompt.
- URL shape changes for nested resources (folders, projects, etc.).
- Deep-link auth flow (visiting `/chat/<id>` while signed out and being prompted to sign in).
