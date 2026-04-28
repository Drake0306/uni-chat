# Mobile composer "Tools" popover — design

**Date:** 2026-04-28
**Status:** approved
**Scope:** Composer toolbar in `src/lib/components/chat-view.svelte` only.

## Motivation

On mobile (`<sm` breakpoint, ≤640px), the composer's three capability toggles — Reasoning effort, Attach PDF, Web search — render as unlabeled icon-only buttons because Tailwind's `hidden sm:inline` strips their text labels. Three identical-looking icons don't tell the user what they do. They're also conditional (Reasoning only for thinking models, Attach only for file-capable models), making the row inconsistent across model selections.

Replace those three inline buttons on mobile with a single labeled "Tools" pill that opens a popover listing each capability with icon, title, subtitle, and current state. Desktop is unchanged.

## Approach: chained popover with in-place sub-view

Mobile-only "Tools" pill (visible at `<sm` only) opens a `Popover` with two views, swapped in place:

**Main view** — up to 3 rows, gated by the same capability conditions as the existing desktop toggles:

| Row | Title | Subtitle | Right-aligned state | Tap behavior |
|---|---|---|---|---|
| Reasoning (`BrainIcon`) — when `showEffortPicker` | "Reasoning effort" | "Choose how hard the model thinks" | Current effort label (Fast/Low/Medium/High) | Swap to reasoning sub-view |
| Attach (`PaperclipIcon`) — when `currentModel.capabilities.files` | "Attach PDF" | "Add a document to the message" | File count or "—" | Close popover, trigger native file picker |
| Web search (`GlobeIcon`) — always | "Web search" | "Search the web for current info" | "On" pill or off-state | Toggle inline; popover stays open so the state change is visible |

**Reasoning sub-view** — back chevron + "Reasoning effort" header + 4 radio options (Fast / Low / Medium / High), wired to the same `chatStore.setEffort()` as desktop. Selecting an effort returns to the main view.

Guest users see locked rows for Attach, Search, and non-Fast effort, matching today's desktop pattern (lock icon, no tap action).

## Trigger button

Pill-shaped button matching the size of the existing toggle pills. Contents:
- `SlidersHorizontalIcon` (suggests "settings/tools")
- "Tools" label
- Tinted background when **any** tool is active: web search on, files attached, or effort != 'fast'. Same violet/teal/pink accents are not mixed; the active state is a single neutral-tinted ring (e.g., `bg-primary/10` + `ring-primary/30`) so it just signals "something's on" without re-encoding which tool.

## Layout switching (CSS-only)

- The mobile Tools pill is wrapped in `<... class="sm:hidden">` so it disappears at `sm:` and up.
- The existing 3 inline toggles are wrapped in `<div class="hidden sm:flex sm:items-center sm:gap-1.5">` so they hide below `sm:`. The conditional `{#if showEffortPicker}` and `{#if currentModel.capabilities.files}` blocks stay inside that wrapper.
- No JS-based viewport detection. No layout flash on resize.

## State

Two new local component variables:
- `toolsOpen: boolean` — bound to the popover's `open` prop.
- `toolsView: 'main' | 'reasoning'` — which sub-view is rendered.

Reset `toolsView` to `'main'` whenever the popover closes (`onOpenChange` callback) so the next open starts clean.

No store changes. Reasoning effort, web search, and attached files continue to use `chatStore.effort`, `chatStore.webSearchEnabled`, and the local `attachedFiles` state respectively. The popover is purely a different surfacing of the same controls.

## Active-state computation

```ts
const anyToolActive = $derived(
  webSearchEnabled || attachedFiles.length > 0 || (showEffortPicker && thinkingActive)
);
```

Used for tinting the Tools pill. Already-derived signals; no new sources.

## Error handling

None new. File picker errors, network failures, and rate-limit responses all flow through the existing handlers in `handleSend()` / `handleFileSelect()`. Popover open/close has no failure path.

## Testing

- `npm run check` for types + Svelte compilation.
- Manual checks in a narrow viewport (DevTools mobile emulation):
  1. Three inline toggles hide below `sm:`; "Tools" pill shows.
  2. Tap "Tools" → main view rows match the same capability conditions as desktop (e.g., switch to a non-thinking model: Reasoning row disappears).
  3. Tap Reasoning row → sub-view; tap an effort → returns to main view; effort label updates.
  4. Tap Attach row → file picker opens, popover closes, selected file appears as a chip above the textarea.
  5. Tap Web search row → toggles state inline; row's right-aligned state updates without closing.
  6. Tools pill tints when any tool is active; un-tints when all are off.
  7. As guest: Attach, Search, non-Fast effort rows all show lock; tapping does nothing.

## Out of scope

- Bottom-sheet variant (Approach B from brainstorming). Could revisit if the popover feels cramped on small phones.
- Reorganizing desktop toggles. Untouched.
- Adding new capabilities (image gen, tools) to the picker. Whatever capability matrix the desktop row uses today, the mobile picker mirrors. New capabilities are added in both places at once.
