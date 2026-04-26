# Uni Chat — Setup Guide

## Prerequisites

- Node.js 20+
- npm
- A Google account (for Supabase + API keys)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd chatCD
npm install
```

---

## 2. API Keys (Free Providers)

Get free API keys from these providers. No credit card required.

| Provider | Get key from | Notes |
|---|---|---|
| Gemini | https://aistudio.google.com/apikey | Free, no CC |
| OpenRouter | https://openrouter.ai/keys | Free, no CC |
| Groq | https://console.groq.com/keys | Free, no CC |
| Mistral | https://console.mistral.ai/api-keys | Free, phone verification |

---

## 3. Supabase Setup

### 3.1 Create a Supabase project

1. Go to https://supabase.com and create a new project
2. Pick a region close to your users
3. Save the database password — you won't see it again

### 3.2 Get your keys

In your Supabase dashboard, go to **Settings → API**:

- **Project URL** — looks like `https://xxxxx.supabase.co`
- **Publishable key** (anon key) — starts with `sb_publishable_` or `eyJ...`
- **Secret key** (service role) — starts with `sb_secret_` or `eyJ...`

### 3.3 Enable Google Auth

1. In Supabase dashboard, go to **Authentication → Providers → Google**
2. Toggle it **ON**
3. You need a Google OAuth Client ID and Secret:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create a new **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** into the Supabase Google provider settings
4. In Supabase **Authentication → URL Configuration**:
   - Set **Site URL** to `http://localhost:5173` (for dev)
   - Add `http://localhost:5173` to **Redirect URLs**

### 3.4 Run Database Migrations

**Option A: CLI (recommended)**

Run these three commands in your terminal:

```bash
# Login to Supabase (opens browser for authentication)
npx supabase login

# Link this project to your Supabase project
npx supabase link --project-ref jutmigwyfmvywymxaosd

# Push all migrations to create tables, RLS policies, and triggers
npx supabase db push
```

This automatically runs all SQL files in `supabase/migrations/` in order.

**Option B: Manual (SQL Editor)**

If the CLI doesn't work, go to your Supabase dashboard **SQL Editor** and run these three files in order:

1. `supabase/migrations/20260426120000_profiles.sql`
2. `supabase/migrations/20260426120001_chats.sql`
3. `supabase/migrations/20260426120002_messages.sql`

Copy the contents of each file and run them one by one.

---

## 4. Environment Variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# ── Free Providers ───────────────────────────────────────────────
OPENROUTER_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here

# ── Supabase ─────────────────────────────────────────────────────
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_secret_key_here

# ── Dev Settings ─────────────────────────────────────────────────
BYPASS_RATE_LIMIT=true    # Set to "true" to skip internal rate limiting in dev
```

---

## 5. Run the App

```bash
npm run dev
```

Open http://localhost:5173

---

## 6. Verify Everything Works

| What to test | How |
|---|---|
| **Chat works** | Type a message, select Gemini 2.5 Flash, send it. You should see a streaming response. |
| **Guest persistence** | Send a message, refresh the page. Chat should appear in the sidebar (saved in localStorage). |
| **Google Sign In** | Click "Sign in with Google" in the sidebar footer. Complete the Google flow. Your avatar and name should appear. |
| **Authenticated persistence** | After signing in, send a message. Refresh the page. Chat should still be in the sidebar (saved in Supabase). |
| **Model selector** | Click the model name in the composer. You should see all companies, models, and capability badges. |
| **Search** | Press `⌘K` (Mac) or `Ctrl+K` (Windows) to open the search palette. |
| **Rate limiting** | Set `BYPASS_RATE_LIMIT=false` in `.env`, restart the server. Send several messages quickly — you should hit the limit. |

---

## Project Structure

```
src/
  routes/
    +layout.svelte              ← Sidebar provider
    +layout.ts                  ← CSR only (ssr = false)
    +page.svelte                ← Chat UI (home page)
    api/
      chat/+server.ts           ← Unified router (validates, rate-limits, forwards)
      providers/
        gemini/+server.ts       ← Google Gemini (direct, SSE transform, thinking)
        openrouter/+server.ts   ← OpenRouter (passthrough)
        groq/+server.ts         ← Groq (passthrough)
        mistral/+server.ts      ← Mistral (passthrough)
        anthropic/+server.ts    ← Stub (403, paid)
        ...                     ← Other paid stubs
  lib/
    supabase.ts                 ← Browser Supabase client
    markdown.ts                 ← Markdown pipeline (unified + shiki + KaTeX)
    types.ts                    ← Shared TypeScript types
    config/
      models.ts                 ← All companies, models, routes, capabilities
    server/
      supabase.ts               ← Server-side auth validation
      rate-limit.ts             ← Per-IP / per-user rate limiter
    stores/
      auth.svelte.ts            ← Auth state (Google SSO, tier, user)
      chats.svelte.ts           ← Chat persistence (Supabase + localStorage)
      command.svelte.ts         ← Command palette state
    components/
      ui/                       ← shadcn-svelte (do not edit)
      app-sidebar.svelte        ← Sidebar (chats, search, auth)
      model-selector.svelte     ← Model picker popup
      markdown-renderer.svelte  ← Renders markdown with code/tables/math
      thinking-block.svelte     ← Collapsible thinking display
      google-icon.svelte        ← Google logo SVG
  app.css                       ← Tailwind + KaTeX + typography
static/
  icons/                        ← Local model/company SVG icons
docs/
  models.md                     ← Model reference table
  providers/                    ← Per-provider research docs
supabase/
  migrations/                   ← SQL migration files
```

---

## Rate Limiting Tiers

| Tier | Per 4 Hours | Per Day | Per Month |
|---|---|---|---|
| Guest (not logged in) | 3 | 8 | — |
| Free (logged in) | 5 | 15 | — |
| Pro | 25 | 150 | 1,000 |
| Max | 60 | 400 | 3,000 |

Set `BYPASS_RATE_LIMIT=true` in `.env` to disable during development.

---

## Common Issues

**"Rate limit exceeded" on every request**
→ Make sure `BYPASS_RATE_LIMIT=true` is in your `.env` and you've restarted the dev server.

**"This model is temporarily busy"**
→ OpenRouter's free model upstream is overloaded. Try a different model (Groq models are the most reliable).

**"Gemini quota exhausted"**
→ Google's free tier has per-day limits (250 for Flash, 100 for Pro). Wait or switch to a different model.

**Google Sign In not working**
→ Check that your Supabase Google provider has the correct Client ID/Secret, and `http://localhost:5173` is in the redirect URLs.

**Icons not loading**
→ Icons are served from `/static/icons/`. Make sure the SVG files are present in that directory.
