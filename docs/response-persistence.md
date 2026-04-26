# Response Persistence: Architecture & Future Plans

## The Problem

When a user refreshes or closes the browser while an LLM response is streaming, the response is lost. The assistant message either never gets saved or gets saved with an error/partial content. This happens because the browser owns the entire response lifecycle — the server is just a proxy piping bytes through.

## Three Approaches Compared

| | Client-only (current) | Server tee() (implementing now) | Job queue (production future) |
|--|--|--|--|
| **Who calls the LLM** | Server (proxy) | Server (proxy) | Dedicated worker process |
| **Who accumulates the response** | Browser only | Browser + server (independently) | Worker only |
| **Who saves to DB** | Browser (user JWT, RLS) | Server (service role key) | Worker (service role key) |
| **Survives browser refresh** | No | Yes | Yes |
| **Survives browser close** | No | Yes | Yes |
| **Survives server restart** | N/A | No — in-flight response is lost | Yes — job resumes or retries |
| **Streaming to browser** | Native SSE | Native SSE (unchanged) | Supabase Realtime subscription or polling |
| **Complexity** | Simplest | Low — one API route change | High — new subsystem |
| **Infrastructure** | Nothing extra | Nothing extra | Persistent worker + job table + Realtime |
| **Auth model** | Browser JWT + RLS | Server validates JWT, writes with service key | Worker uses service key, job created with JWT validation |
| **Cost if user leaves** | None (stream dies) | LLM finishes generating (tokens used) | LLM finishes generating (tokens used) |
| **Time to implement** | Done | Hours | Days to weeks |

## Current Architecture (Client-only)

```
Browser                          Server (/api/chat)              LLM Provider
  |                                  |                               |
  |-- POST {messages} ------------->|                               |
  |                                  |-- POST {model, messages} --->|
  |                                  |<---- SSE stream -------------|
  |<-------- SSE stream ------------|                               |
  |                                  |                               |
  | (accumulates chunks locally)     | (nothing — dumb pipe)        |
  | (saves to Supabase when done)    |                               |
  |                                  |                               |
  | ** USER REFRESHES **             |                               |
  | (JS context destroyed)           |                               |
  | (message never saved)            |                               |
```

**Data flow for writes:**
1. Browser creates chat row → Supabase (browser client, user JWT, RLS enforced)
2. Browser saves user message → Supabase (browser client, user JWT, RLS enforced)
3. Browser saves assistant message → Supabase (browser client, user JWT, RLS enforced)

All three writes use the user's session. RLS ensures users can only write to their own chats. The server has zero knowledge of chats or messages.

## Server tee() Architecture (Implementing Now)

```
Browser                          Server (/api/chat)              LLM Provider
  |                                  |                               |
  |-- POST {chatId, messageId,       |                               |
  |         messages} ------------->|                               |
  |                                  |-- create empty assistant msg  |
  |                                  |   in Supabase (service key)   |
  |                                  |                               |
  |                                  |-- POST {model, messages} --->|
  |                                  |<---- SSE stream -------------|
  |                                  |                               |
  |                                  |-- tee() the stream:           |
  |                                  |   branch A → stream to client |
  |<-------- SSE stream ------------|   branch B → accumulate       |
  |                                  |                               |
  | (displays chunks)               | (accumulates full response)   |
  |                                  |                               |
  | ** USER REFRESHES **             |                               |
  | (client stream cancelled)        |                               |
  |                                  | (server stream continues!)    |
  |                                  | (LLM finishes generating)     |
  |                                  |                               |
  |                                  |-- update assistant message    |
  |                                  |   with full content            |
  |                                  |   in Supabase (service key)   |
  |                                  |                               |
  | ** USER RETURNS **               |                               |
  | (loads chat from Supabase)       |                               |
  | (sees complete response)         |                               |
```

**Data flow for writes:**
1. Browser creates chat row → Supabase (browser client, user JWT, RLS) — unchanged
2. Browser saves user message → Supabase (browser client, user JWT, RLS) — unchanged
3. Server creates assistant message → Supabase (service client, service role key, bypasses RLS)
4. Server updates assistant message with content when done → Supabase (service client)

**What changes from current:**
- `/api/chat` now receives `chatId` and `messageId` from the client
- `/api/chat` uses the service client (already exists in `src/lib/server/supabase.ts`) to write assistant messages
- The service role key bypasses RLS — this is safe because the server validates the user's JWT before writing, and only writes to the chat the user owns
- The browser no longer saves the assistant message (the server handles it)
- `ReadableStream.tee()` splits the provider response: one branch for the client, one for server-side accumulation

**Limitation:** If the server process dies (deploy, crash, OOM) while accumulating, the in-flight response is lost. The empty assistant message row would remain in the DB with no content. This is rare in production but possible.

## Job Queue Architecture (Future Production)

This is the approach for when Uni Chat goes to production and needs bulletproof response delivery. It decouples response generation from the HTTP request entirely.

### New infrastructure required

1. **`generation_jobs` table** in Supabase:
   ```sql
   create table public.generation_jobs (
     id uuid primary key default gen_random_uuid(),
     chat_id uuid not null references public.chats(id) on delete cascade,
     message_id uuid not null references public.messages(id) on delete cascade,
     user_id uuid not null references public.profiles(id),
     model_id text not null,
     company_id text not null,
     input_messages jsonb not null,       -- the conversation history sent to the LLM
     thinking boolean default false,
     status text not null default 'pending'
       check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
     started_at timestamptz,
     completed_at timestamptz,
     error text,                          -- error message if failed
     created_at timestamptz not null default now()
   );

   alter table public.generation_jobs enable row level security;

   create policy "Users can read own jobs"
     on public.generation_jobs for select
     using (auth.uid() = user_id);

   create index idx_jobs_status on public.generation_jobs(status)
     where status in ('pending', 'processing');
   ```

2. **Worker process** — a long-running process that:
   - Polls `generation_jobs` for `status = 'pending'` (or uses Supabase Realtime / pg_notify)
   - Claims the job (`status = 'processing'`, `started_at = now()`)
   - Calls the LLM provider
   - Accumulates the response
   - Saves to `messages` table
   - Updates the job (`status = 'completed'`, `completed_at = now()`)
   - On error: updates the job (`status = 'failed'`, `error = ...`)
   - On timeout: a separate cleanup process marks stale `processing` jobs as `failed`

3. **Supabase Realtime subscription** (or polling) — the browser subscribes to changes on the `messages` table for the current chat. When the worker saves/updates the assistant message, the browser gets the update in real-time and renders it.

### How the flow changes

```
Browser                          Server (/api/chat)         Worker              LLM Provider
  |                                  |                        |                     |
  |-- POST {chatId, messageId,       |                        |                     |
  |         messages} ------------->|                        |                     |
  |                                  |                        |                     |
  |                                  |-- create assistant msg |                     |
  |                                  |   (empty, service key) |                     |
  |                                  |                        |                     |
  |                                  |-- create generation_job|                     |
  |                                  |   (status: pending)    |                     |
  |                                  |                        |                     |
  |<-- 202 Accepted (jobId) --------|                        |                     |
  |                                  |                        |                     |
  | (subscribes to Realtime on       |                        |-- picks up job      |
  |  messages table for this chat)   |                        |-- calls LLM ------->|
  |                                  |                        |<-- SSE stream ------|
  |                                  |                        |                     |
  |                                  |                        | (accumulates)       |
  |                                  |                        | (periodic updates   |
  |                                  |                        |  to messages table)  |
  |                                  |                        |                     |
  |<-- Realtime: message updated ----|------------------------|                     |
  | (renders partial content)        |                        |                     |
  |                                  |                        |                     |
  | ** USER CLOSES BROWSER **        |                        |                     |
  |                                  |                        | (keeps going)       |
  |                                  |                        | (LLM finishes)      |
  |                                  |                        | (saves final msg)   |
  |                                  |                        | (job: completed)    |
  |                                  |                        |                     |
  | ** USER RETURNS HOURS LATER **   |                        |                     |
  | (loads chat from Supabase)       |                        |                     |
  | (sees complete response)         |                        |                     |
```

### Streaming with job queue

The current SSE streaming (where the browser reads chunks directly from the LLM) would be replaced by one of:

**Option A: Supabase Realtime (recommended)**
- Worker periodically updates the message row (e.g., every 500ms or every 200 chars)
- Browser subscribes to `postgres_changes` on the `messages` table
- Each update triggers a re-render
- Feels like streaming but with slight latency (~500ms chunks instead of token-by-token)
- Pro: Works even if browser disconnects and reconnects — it just picks up the latest state
- Con: Not true token-by-token streaming; slightly chunky

**Option B: Hybrid — SSE for live streaming, Realtime for recovery**
- Server still streams to browser via SSE (for the live experience)
- Worker also runs in the background saving to DB
- If the browser disconnects, Realtime picks up where SSE left off
- Pro: Best UX — token-by-token when live, recovery when not
- Con: Most complex — two streaming paths

**Option C: Polling**
- Browser polls the message row every 1-2 seconds
- Simplest to implement
- Con: Laggy, wasteful, bad UX

### Worker technology options

| Option | Language | Pros | Cons |
|--------|----------|------|------|
| **Supabase Edge Functions** | TypeScript (Deno) | Same ecosystem, auto-scales, no infra to manage | Cold starts, 150s execution limit (may not be enough for long responses), Deno not Node |
| **Node.js service** | TypeScript | Same language as SvelteKit, shared types/models, full control | Need to host and manage separately, need process manager (PM2, Docker) |
| **SvelteKit background task** | TypeScript | No new service, runs in same process | Tied to server lifecycle, lost on restart — same problem as tee() |
| **Python worker** | Python | Rich ML/AI ecosystem | Different language, duplicated types/config, team needs Python skills |
| **Go worker** | Go | Very performant, low resource usage | Different language, overkill for this use case |

### When to build the job queue

Build it when ANY of these are true:
- Deploying to a platform with frequent cold starts or short-lived processes (serverless, Vercel)
- Users report lost responses in production (the tee() limitation is being hit)
- Adding features that need guaranteed delivery (email notifications of completed responses, mobile push)
- Scaling to many concurrent users (job queue lets you rate-limit worker concurrency)

### Migration path from tee() to job queue

The tee() approach is designed to make this migration straightforward:

1. The server already writes assistant messages with the service client — the worker does the same
2. The client already sends `chatId` and `messageId` — add `jobId` to the response
3. The client already loads messages from Supabase on page load — add Realtime subscription
4. The `/api/chat` route changes from "proxy + accumulate" to "create job + return 202"
5. The LLM provider call moves from the API route to the worker

No database schema changes needed for `chats` or `messages`. Only the new `generation_jobs` table is added.
