# Dedicated `/login` page — design

**Date:** 2026-04-28
**Status:** approved
**Scope:** UX-only refactor of the sign-in trigger. No change to auth mechanics.

## Motivation

Today the sidebar has a "Sign in with Google" button that calls `authStore.signInWithGoogle()` directly, kicking off the Supabase OAuth redirect inline. We want a dedicated full-screen sign-in page so the sign-in moment has its own visual real estate (and a place to attach future affordances like T&C links, email/password fallback, or marketing copy).

## Non-goals

- **Not** a security refactor. The OAuth handshake already runs off our client (Google + Supabase servers handle the credential exchange). The session token still lives in JS-accessible storage; moving it to HttpOnly cookies is a separate, larger project that would unwind the project-wide `ssr = false` decision.
- **Not** a new auth provider or new flow. We keep `supabase.auth.signInWithOAuth({ provider: 'google' })` exactly as it is.

## Approach: client-rendered `/login` route

Matches the existing CSR-only architecture (`src/routes/+layout.ts: ssr = false`). No new server code, no SSR opt-in, no cookie plumbing.

### Components

1. **`src/routes/login/+page.svelte`** (new)
   - Full-viewport centered card.
   - "Continue with Google" button: reuses `GoogleIcon` + `Button` (outline variant) for visual continuity with the previous sidebar button.
   - `$effect` watches `authStore.isAuthenticated`; when it flips true, `goto('/', { replaceState: true })`.
   - Also redirects to `/` immediately if user is already authenticated on mount (avoids showing the sign-in page to a signed-in user).

2. **`src/routes/+layout.svelte`** (edit one line)
   - Extend the `fullViewport` predicate from `pathname.startsWith('/settings')` to also match `/login`, so the sidebar shell does not render on the sign-in screen.

3. **`src/lib/components/app-sidebar.svelte`** (edit the unauthenticated branch)
   - Change button label "Sign in with Google" → "Sign in".
   - Remove the inline `GoogleIcon` from the button.
   - Change `onclick={() => authStore.signInWithGoogle()}` → `onclick={() => goto('/login')}`.
   - Drop the `GoogleIcon` import from app-sidebar (it is now only used inside `/login/+page.svelte`).

### Data flow (unchanged from today)

```
sidebar "Sign in"  →  goto('/login')
/login "Continue with Google"  →  authStore.signInWithGoogle()
                              →  redirect to accounts.google.com
                              →  Google → Supabase /auth/v1/callback
                              →  redirect to window.location.origin (i.e. /login)
                              →  onAuthStateChange fires SIGNED_IN
                              →  authStore.isAuthenticated flips true
                              →  /login's $effect fires goto('/')
```

The Supabase OAuth `redirectTo` is currently `window.location.origin` — i.e., `/`. We will keep it as-is so the user lands on the chat home directly. The `$effect` fallback in `/login` covers the edge case where the OAuth round-trip lands them back on `/login` (e.g., if they signed in already via another tab and the listener fires before navigation).

### Error handling

Failed OAuth (user cancels Google consent, network error) currently logs `console.error` in `authStore.signInWithGoogle()`. We will not add new UI surfacing here; that's outside scope. Failures leave the user on `/login` with the button still clickable.

### Testing

`npm run check` for type + Svelte compilation. Manual verification in a browser:
1. Visit `/`, sidebar shows "Sign in" button.
2. Click → land on `/login`, no sidebar.
3. Click "Continue with Google" → Google consent → land on `/` signed in.
4. Click sidebar button while already signed in: not possible (it's hidden behind the avatar dropdown when authenticated).
5. Visit `/login` directly while signed in: redirected to `/`.

### Out of scope (potential follow-ups)

- Move session to HttpOnly cookies (the actual XSS-hardening security upgrade). Would require flipping SSR back on, adding `hooks.server.ts`, and rewriting `auth.svelte.ts`.
- SSR-rendered `/login` that 302-redirects already-authenticated users before any JS loads (modest preload-flicker improvement, not worth the architectural deviation by itself).
- Email/password or magic-link fallback sign-in.
