# Command palette (⌘K) redesign

**Date:** 2026-04-28
**Status:** approved
**Scope:** Replace the inline `Command.Dialog` block in `src/lib/components/app-sidebar.svelte:649–729` with a dedicated `<CommandPalette />` component that turns ⌘K into a multi-type command center.

## Motivation

Today's palette is a flat list of chat titles with a pin icon. No metadata, no date bucketing, no actions, no preview. Mobile is a sticky-top dialog hack. Users see "thing they already see in the sidebar, slightly differently."

The redesign treats ⌘K as the app's primary "get me anywhere / do anything" surface — search + actions in one keystroke, with rich result rendering and a preview pane that makes arrow-key navigation feel useful.

## Concept

- **Multi-type results in one search box.** Quick actions, pinned chats, and date-bucketed recent chats coexist; a `>` prefix filters to actions only (Linear/Slack convention).
- **Two-pane on desktop, full-screen sheet on mobile.** Result list on the left, contextual preview on the right (desktop only).
- **Date-bucketed chats.** Pinned · Today · Yesterday · This week · This month · Older.
- **Keyboard-first.** Persistent footer hint bar on desktop. Mobile gets a sticky "Open" button reflecting the highlighted item.
- **Match highlighting.** Bold the matched substring in chat titles.
- **Theme-coherent.** Reuses the rounded-2xl, `bg-popover`, `ring-1` token language already established in the model selector and theme.

## Components and data

### New files
- `src/lib/components/command-palette.svelte` — the palette itself. Uses `Command.Dialog` for both viewports; responsive sizing makes it full-screen on mobile and centered on desktop. Owns: debounced search, action filtering, date bucketing, preview-pane rendering.
- `src/lib/config/quick-actions.ts` — typed registry of quick actions. One row per action: `id`, `label`, `description`, `icon` (Svelte component), `synonyms` (extra search terms), `shortcut?`, `visible?` (predicate against `authStore`/etc.), `onSelect` (handler). Easy to add more without touching the palette.
- `src/lib/utils/relative-date.ts` — `formatRelative(date)` returns `Just now` / `Xm ago` / `Xh ago` / `Yesterday` / `Mon` (within 7 days) / `Mar 12` / `Mar 12, 2024`.
- `src/lib/utils/match-highlight.ts` — `splitMatch(text, query)` returns segment array `{text, match}[]` for inline `<mark>`-style rendering.

### Edited files
- `src/lib/components/app-sidebar.svelte` — drops the inline palette; mounts `<CommandPalette bind:open={commandStore.open} />` in its place. Drops palette-specific local state (`searchQuery`, `searchResults`, `searchLoading`, `searchTimer`, `searchPinned`, `searchOther`, `recentForPalette`) since they move into the new component.

### Stores consumed (unchanged)
- `chatStore.pinnedChats` — for the Pinned group.
- `chatStore.todayChats + chatStore.otherChats` — re-bucketed by `updated_at` into Today/Yesterday/This week/This month/Older.
- `chatStore.searchChats(q)` — server-side chat search. Existing 300ms debounce pattern is moved into the new component.
- `themeStore.set` — for the Toggle theme action.
- `authStore.signOut`, `authStore.isAuthenticated` — for the Sign out action's handler and `visible?` predicate.

## Layout

### Desktop (≥ sm:)
- Outer: `Command.Dialog`, max-w-4xl, centered modal.
- Inside: 60/40 split — left column scrollable result list; right column preview pane.
- Footer: persistent keyboard hint bar (`↑↓ navigate · ↵ open · ⌘↵ open in new tab · `>` cmds · esc close`).

### Mobile (< sm:)
- Outer: same `Command.Dialog`, but `inset-0`, no max-w, no rounding — covers the whole viewport.
- Inside: single column, no preview pane.
- Sticky header (close `✕` + search input), sticky footer with primary "Open ↵" button.
- Larger row touch targets (`py-3`), two-line rows (title on top, relative date underneath).

Visual switch is purely Tailwind responsive classes — no JS viewport detection, no second component tree.

## Quick actions (initial set)

| Action | Trigger | Visible when |
|---|---|---|
| New chat | `goto('/')` | always |
| Settings | `goto('/settings')` | authenticated (matches existing sidebar dropdown) |
| Toggle theme | cycles `themeStore` (light → dark → auto → light) | always |
| Sign out | `authStore.signOut()` | authenticated |

Temporary-chat toggle is intentionally **out of scope** — its state lives as local `$state` in `chat-view.svelte` rather than a store, so wiring it from the palette would require either a state-lift refactor or a brittle global ref. Worth doing later as a separate change.

## Date bucketing

`formatBucket(updated_at, now)` returns one of: `'Today'`, `'Yesterday'`, `'This week'`, `'This month'`, `'Older'`. Computed once per chat at render time. Within each bucket, chats stay in `updated_at desc` order (already how the store ships them). Pinned chats render as a separate "Pinned" group above all date buckets, regardless of their `updated_at`.

## Search behavior

- **Empty query.** All groups render. Quick actions first (filtered by `visible?` predicates). Then Pinned. Then Today / Yesterday / This week / This month / Older — each capped at 10 rows so the palette doesn't become a sprawl on a heavy account.
- **Has query.** 300ms debounce. Server-side chat search via `chatStore.searchChats(q)`. Actions filtered client-side by matching against `label + description + synonyms`. Results re-grouped: Quick actions / Pinned / [date buckets].
- **`>` prefix.** Strip the `>` and any leading whitespace; pass remainder to action filter; skip chat search entirely. Heading reads "Commands" instead of "Quick actions".

## Match highlighting

`splitMatch(text, query)` returns `{text, match}[]` segments. Component renders matches with `class="font-semibold text-foreground"` (vs default `text-muted-foreground` for the surrounding text). No `<mark>` element — the existing Tailwind palette doesn't have a mark-style background that fits the design language. Bolding + foreground-color contrast is enough for a clean look.

## Preview pane (desktop only)

Right pane content depends on the highlighted result type:
- **Chat highlighted**: title (large), updated-at full timestamp, model name, message count, first-message preview (3 lines, clamped), last-message preview (3 lines, clamped). Click "Open" or press ↵ navigates.
- **Action highlighted**: action icon (large), label, description, keyboard shortcut if any.
- **Nothing highlighted / empty results**: faded "Search for a chat or action…" placeholder.

For chats, message previews come from `chatStore.fetchChatMessages(chat.id)` — already implemented (`app-sidebar.svelte` uses it for title regeneration). Cached per-chat-id within the component so arrowing back and forth doesn't re-fetch.

## Keyboard model

| Key | Action |
|---|---|
| ↑↓ | Navigate (cmdk-svelte default) |
| ↵ | Execute selected action / open selected chat |
| ⌘↵ | Open selected chat in new tab (chats only; actions ignore the modifier) |
| `>` | Filter to actions |
| ⌘K | Toggle palette (existing global handler in app-sidebar) |
| esc | Close (cmdk-svelte default) |

## Error handling

- Server-side search failure: silent — empty result list, "No conversations found" empty state. Already how the current palette handles it.
- Preview-pane fetch failure: silent — show "Couldn't load preview" in muted text. Doesn't block navigation.
- Action handler throws: bubble up; let app-level error boundaries / sentry catch. Palette closes on Enter regardless (we'd rather a possibly-half-applied action than a stuck modal).

## Testing

- `npm run check` for types and Svelte compilation.
- Manual matrix:
  1. ⌘K opens, esc closes; ⌘K toggles.
  2. Empty query: Quick actions + Pinned + date buckets all render. Action `visible?` predicates work (Settings/Sign out hidden when guest).
  3. Type a query: chat search runs (300ms debounce). Action filter runs immediately.
  4. `>` prefix: actions only.
  5. Arrow keys: highlight moves; preview pane updates on desktop.
  6. ↵: opens highlighted result.
  7. ⌘↵ on chat: opens in new tab.
  8. Mobile (DevTools narrow): full-screen sheet, sticky footer Open button reflects highlighted item.
  9. Match highlighting visible on titles.
  10. Date buckets correct relative to "now" (test by changing system date or tweaking a chat's updated_at).

## Out of scope

- Temporary-chat toggle as a quick action (would need state lift).
- Model switching as an action (interesting future addition).
- Recent-search history (localStorage of last 5 queries).
- Right-arrow on a result revealing an action sub-menu (Raycast pattern).
- `@model` prefix routing.
- Preview pane on mobile (no horizontal space, low value).
