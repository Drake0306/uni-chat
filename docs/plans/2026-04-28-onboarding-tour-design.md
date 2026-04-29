# First-login onboarding tour

**Date:** 2026-04-28
**Status:** approved
**Scope:** New guided spotlight tour shown to first-time logged-in users, with separate mobile and desktop step lists. Persistent dismissal via a new `profiles.onboarding_dismissed` column.

## Goals

A new logged-in user should learn the seven-or-so non-obvious controls that make this app work — model selector, reasoning effort, web search, file attach, command palette, sidebar — in ~30 seconds, without leaving the chat surface. Once they say "don't show again," they never see it again. Until they say that, every fresh sign-in re-triggers the tour so they get another chance.

Guests don't see the tour. Settings and login routes don't show it.

## Concept

A dimmed full-viewport overlay with a "spotlight" cut around the highlighted target plus a callout card next to it. Smooth transitions between steps; subtle pulsing ring around the spotlight; clean Tailwind visuals matching the existing palette (rounded-2xl, ring-1, popover-bg).

Two interaction paths:
- **Mid-tour close** (X button, click outside, Skip, ESC) → session-only dismiss; tour returns on next sign-in.
- **Final step → "Don't show again" toggle + Got it** → DB write; tour never appears again for this user.

## Step lists

Different on mobile vs desktop because the UI itself is different (mobile collapses the capability toggles into a single Tools popover; the sidebar is off-canvas; ⌘K is keyboard-only).

### Desktop (7 steps)

| # | Title | Target | Blurb |
|---|---|---|---|
| 1 | Welcome to Uni Chat | (centered, no spotlight) | "30 seconds to learn the controls." |
| 2 | Type & send | composer textarea | "Type your message and press Enter to send." |
| 3 | Switch models | model selector pill | "Different AI models, different strengths. Browse free + paid options." |
| 4 | Think harder, search the web, attach files | capability toggles row | "Toggle deeper thinking, turn on live web search, or attach a PDF." |
| 5 | Quick search & commands | sidebar's Search button (or ⌘K hint) | "Press ⌘K to find any chat or run a command." |
| 6 | New chats & history | sidebar's New chat button | "Start fresh or revisit any conversation here." |
| 7 | You're all set | (centered) | "Don't show again" toggle + Got it button. |

### Mobile (5 steps)

| # | Title | Target | Blurb |
|---|---|---|---|
| 1 | Welcome to Uni Chat | (centered) | "Quick tour of the basics." |
| 2 | Type & send | composer textarea | "Type your message. Tap the send button or press Enter." |
| 3 | Switch models | model selector pill | "Different AI models, different strengths." |
| 4 | Tools | the mobile Tools pill | "Tap to toggle reasoning depth, turn on web search, or attach a PDF." |
| 5 | Sidebar & search | the floating-toolbar group (sidebar trigger + search + new chat) | "Open the sidebar for chat history. Search opens a quick-find palette." |
| 6 | You're all set | (centered) | "Don't show again" toggle + Got it button. |

(Mobile is one shorter because the desktop ⌘K and "new chat in sidebar" steps fold into the floating-toolbar step.)

The two lists share components, animations, and layout — they only differ in the array of steps and the per-step target lookup. A single `isMobile = matchMedia('(max-width: 639px)').matches` decides which list runs.

## Visual & animations

- **Backdrop**: full-viewport `position: fixed`, `bg-foreground/60` (semi-dark in light mode, lighter in dark mode for contrast).
- **Spotlight**: positioned absolutely via the target's `getBoundingClientRect()` plus a small padding (8px). Implemented with `box-shadow: 0 0 0 9999px var(--backdrop-color)` so the inner area is "cut" out of the dim. `border-radius: 0.875rem` matches the surrounding pills/cards.
- **Pulse ring**: a thin 2px ring just outside the spotlight, scaling `1 → 1.06 → 1` on a 1.6s loop with `border-color` going `primary/40 → primary/0 → primary/40`. Subtle, not noisy.
- **Callout card**: `rounded-2xl bg-popover ring-1 ring-border shadow-lg`, max-w-sm. Positioned via a `placement` algorithm that picks above / below / left / right based on which side has the most space relative to the spotlight, with an 8px gap. Falls back to centered when no target.
- **Step transitions**: CSS `transition: top, left, width, height 0.3s ease-out` on the spotlight; `opacity` + `translateY(8px) → 0` fade for the callout when the step changes (300ms). Spotlight smoothly morphs to the next target.
- **Reposition on layout shift**: `ResizeObserver` on `document.body` + `window` resize listeners + scroll listener — recompute the target rect, update spotlight position. Throttled with `requestAnimationFrame`.

## Architecture

### Database

New migration `supabase/migrations/<timestamp>_onboarding_dismissed.sql`:

```sql
alter table public.profiles
  add column onboarding_dismissed boolean not null default false;
```

Default is `false` for *all* rows including existing ones — so users who signed up before this feature also see the tour next time they log in. (Per the explicit "show the tour to existing users" decision.)

### Auth store extensions

`src/lib/stores/auth.svelte.ts`:
- New `onboardingDismissed` `$state<boolean | null>` (null = not yet fetched).
- The existing tier-fetch in `onAuthStateChange` extends to `select('tier, onboarding_dismissed')`. On success, `onboardingDismissed = data.onboarding_dismissed`. On error, leave as null (treat as "don't show" to avoid surprise tours on broken loads).
- New method `dismissOnboarding()`:
  ```ts
  async dismissOnboarding() {
    if (!user) return;
    onboardingDismissed = true; // optimistic
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_dismissed: true })
      .eq('id', user.id);
    if (error) console.error('[auth] dismissOnboarding failed:', error.message);
    // Don't revert on error — better to silently keep it dismissed than surprise the user with another tour.
  }
  ```
- Reset `onboardingDismissed = null` on SIGNED_OUT so a different user signing into the same tab gets their own value.

### New component

`src/lib/components/onboarding-tour.svelte`:
- Owns: `currentStep` index, `dismissForever` toggle, `targetRect` derived from `getBoundingClientRect()`, `placement` derived (above/below/left/right).
- Imports: `authStore`, plus the relevant icons.
- Reads media query reactively to choose the steps array.
- Renders: backdrop, spotlight, pulse ring, callout card, controls.
- The component is mounted at the layout level but only *renders* its DOM when the gate is satisfied.

### Mounting

`src/routes/+layout.svelte` already mounts `<SyncPromptDialog />` and `<SessionExpiredDialog />`. Add `<OnboardingTour />` next to them, gated *internally* by:
- `!authStore.loading`
- `authStore.isAuthenticated`
- `authStore.onboardingDismissed === false` (strict false, not null)
- Not on `/settings`, `/login` routes
- `!authStore.pendingSyncDecision` (don't stack with the localStorage→DB sync prompt)

### Target lookup

Each step references a stable selector like `[data-onboarding="composer"]`. New `data-onboarding` attributes go on:
- `chat-view.svelte` textarea → `composer`
- `chat-view.svelte` model selector wrapper → `model-selector`
- `chat-view.svelte` desktop capability toggles container → `capability-toggles`
- `chat-view.svelte` mobile Tools pill button → `tools-mobile`
- `chat-view.svelte` floating-toolbar group (mobile only) → `floating-toolbar-left`
- `app-sidebar.svelte` New chat button → `new-chat`
- `app-sidebar.svelte` Search button → `search-trigger`

If a target isn't found (e.g. the model selector is collapsed off-screen), the tour skips that step gracefully with a console.warn.

## State machine

```
gate satisfied?
  no → render nothing
  yes → step = 0 (Welcome)
        ├ Next → step++
        ├ Back → step--
        ├ Skip / X / esc → close, no DB write (session-only dismiss)
        └ on last step:
            ├ Got it (toggle off) → close, no DB write
            └ Got it (toggle on)  → close + dismissOnboarding() (DB write)
```

Closing flips a local `closed = true` flag — the gate stops re-rendering until the next page load / sign-in. Persistent dismiss flips `authStore.onboardingDismissed = true` which makes the gate fail across reloads too.

## Edge cases

- **Window resize during tour**: `ResizeObserver` keeps the spotlight aligned.
- **Target moves during tour** (e.g., user opens a popover that pushes content): same observer handles it; if the target disappears, advance to the next step automatically.
- **DB write fails**: silent — user sees the tour again next session, mildly annoying but not broken.
- **User signs out mid-tour**: gate flips false → tour unmounts.
- **Dark mode**: backdrop uses `var(--foreground)` at 0.6 opacity, so it inverts naturally.
- **Reduced motion**: respect `prefers-reduced-motion: reduce` — disable spotlight transition + pulse, keep instant snaps.

## Out of scope

- Guest-mode onboarding tour (different scope; can fast-follow).
- Re-triggering the tour from a "Show me the tour again" button in Settings (easy to add later — just call `authStore.resetOnboarding()` and reload).
- Showing tour mid-session right after sign-in (the layout effect catches it on the next render anyway).
- Internationalization of tour copy (English-only for now).
- Analytics / telemetry on completion rate.

## Testing

- `npm run check`.
- Manual:
  1. Run the migration in Supabase.
  2. Sign in as a new user → tour appears.
  3. Skip → next sign-in shows it again.
  4. Walk through all steps → spotlight aligns with each target on desktop and on mobile.
  5. Toggle "Don't show again" → click Got it → DB row updated, refresh shows nothing.
  6. Sign out → sign back in → still nothing.
  7. Resize window mid-tour → spotlight follows.
  8. Open in dark mode → contrast still readable.
  9. As guest → no tour.
