# Server-Side Response Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make LLM responses survive browser refresh/close by accumulating and persisting them server-side.

**Architecture:** The `/api/chat` route receives `chatId` and `messageId` from the client. It uses `tee()` to split the provider stream — one branch streams to the client (unchanged UX), the other accumulates on the server. When the LLM finishes, the server parses the accumulated SSE into content/reasoning and saves (or updates) the assistant message in Supabase via the service client. The client no longer saves the assistant message.

**Tech Stack:** SvelteKit API routes, `ReadableStream.tee()`, existing Supabase service client (`getServiceClient()`), existing SSE format (OpenAI-compatible `data: {"choices":[{"delta":{"content":"..."}}]}`)

---

### Task 1: Server-side SSE parser + DB persistence helper

Create a utility that the `/api/chat` route will use to accumulate SSE chunks and save the result.

**Files:**
- Create: `src/lib/server/stream-persist.ts`

**Step 1: Create the SSE parser and save function**

This module does two things:
1. Reads a `ReadableStream` to completion, parsing SSE chunks into content + reasoning
2. Saves the result to Supabase via the service client

```ts
import { getServiceClient } from './supabase.js';

/**
 * Parse accumulated SSE text (OpenAI-compatible format) into content and reasoning.
 * All provider routes normalize to this format before reaching /api/chat.
 */
export function parseSSE(raw: string): { content: string; reasoning: string } {
	let content = '';
	let reasoning = '';

	for (const line of raw.split('\n')) {
		if (!line.startsWith('data: ')) continue;
		const data = line.slice(6).trim();
		if (data === '[DONE]') break;

		try {
			const parsed = JSON.parse(data);
			const delta = parsed.choices?.[0]?.delta;
			if (delta?.reasoning_content) reasoning += delta.reasoning_content;
			if (delta?.content) content += delta.content;
		} catch {
			// skip unparseable chunks
		}
	}

	return { content, reasoning };
}

/**
 * Read a stream branch to completion, parse the SSE, and save to Supabase.
 * Runs as a fire-and-forget background task — errors are logged, never thrown.
 */
export async function accumulateAndSave(
	stream: ReadableStream<Uint8Array>,
	chatId: string,
	messageId: string,
	modelName?: string
): Promise<void> {
	const decoder = new TextDecoder();
	const reader = stream.getReader();
	let raw = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			raw += decoder.decode(value, { stream: true });
		}
	} catch (err) {
		console.error('[stream-persist] Error reading stream:', err);
	}

	const { content, reasoning } = parseSSE(raw);

	if (!content && !reasoning) {
		// LLM produced nothing — don't save an empty message
		return;
	}

	try {
		const supabase = getServiceClient();
		const { error } = await supabase
			.from('messages')
			.upsert({
				id: messageId,
				chat_id: chatId,
				role: 'assistant',
				content: content || 'No response generated.',
				reasoning: reasoning || null,
				model_name: modelName || null,
				is_error: !content,
			});
		if (error) console.error('[stream-persist] Supabase upsert error:', error);
	} catch (err) {
		console.error('[stream-persist] Failed to save message:', err);
	}
}
```

**Step 2: Commit**

```bash
git add src/lib/server/stream-persist.ts
git commit -m "feat: add server-side SSE stream accumulator and DB persistence"
```

---

### Task 2: Update `/api/chat` to tee() and persist

Modify the chat route to accept `chatId`/`messageId`, tee the provider stream, and fire-and-forget the accumulation.

**Files:**
- Modify: `src/routes/api/chat/+server.ts`

**Step 1: Update the route**

The full updated file:

```ts
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findModel } from '$lib/config/models.js';
import { checkRateLimit, type Tier } from '$lib/server/rate-limit.js';
import { getAuthUser, getServiceClient } from '$lib/server/supabase.js';
import { accumulateAndSave } from '$lib/server/stream-persist.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();
	const { companyId, modelId, messages, chatId, messageId } = body;

	if (!companyId || !modelId || !messages) {
		return json({ error: 'Missing companyId, modelId, or messages' }, { status: 400 });
	}

	// Determine auth state and rate limit identity
	const user = await getAuthUser(request);
	let rateLimitKey: string;
	let tier: Tier = 'guest';

	if (user) {
		rateLimitKey = user.id;
		const { data: profile } = await getServiceClient()
			.from('profiles')
			.select('tier')
			.eq('id', user.id)
			.single();
		tier = (profile?.tier as Tier) ?? 'free';
	} else {
		rateLimitKey =
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			request.headers.get('cf-connecting-ip') ||
			'unknown';
	}

	const rateCheck = checkRateLimit(rateLimitKey, tier, { BYPASS_RATE_LIMIT: env.BYPASS_RATE_LIMIT });
	if (!rateCheck.allowed) {
		return json(
			{ error: 'Rate limit exceeded. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
		);
	}

	const model = findModel(companyId, modelId);
	if (!model) {
		return json({ error: `Unknown model: ${modelId}` }, { status: 400 });
	}

	if (!model.enabled) {
		return json({ error: `${model.name} requires a Pro subscription.` }, { status: 403 });
	}

	const response = await fetch(model.route, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: model.apiModelId,
			messages,
			...(body.thinking && { thinking: true }),
		}),
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({ error: 'Provider error' }));
		return json(err, { status: response.status });
	}

	// If client sent chatId + messageId (authenticated user), tee the stream:
	// one branch goes to the client, the other accumulates and saves to DB.
	// If no chatId (guest user), just pipe through as before.
	if (response.body && chatId && messageId && user) {
		const [clientStream, serverStream] = response.body.tee();

		// Fire-and-forget: accumulate + save runs independently of the client
		accumulateAndSave(serverStream, chatId, messageId, model.name).catch((err) =>
			console.error('[api/chat] Background save failed:', err)
		);

		return new Response(clientStream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	}

	// Guest fallback: pipe through unchanged
	return new Response(response.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		},
	});
};
```

Key changes:
- Destructure `chatId` and `messageId` from the request body
- When present (authenticated user): `tee()` the stream, fire-and-forget `accumulateAndSave`
- When absent (guest): unchanged passthrough behavior

**Step 2: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: tee() provider stream for server-side response persistence"
```

---

### Task 3: Update the client to send chatId/messageId and stop saving assistant messages

The client needs to:
1. Send `chatId` and `messageId` in the request body
2. Stop saving the assistant message itself (server handles it for authenticated users)
3. Keep saving for guest users (no server persistence for guests)

**Files:**
- Modify: `src/routes/+page.svelte` (the `handleSend` function, lines ~140-269)

**Step 1: Update handleSend**

Changes to the existing function:

a) Add `chatId` and `messageId` to the fetch body (after line 195, inside the JSON.stringify):

```ts
body: JSON.stringify({
	companyId: selectedModel.companyId,
	modelId: selectedModel.modelId,
	messages: messages
		.filter((m) => m.id !== assistantMsg.id && !m.isError)
		.map((m) => ({ role: m.role, content: m.content })),
	...(thinkingEnabled && { thinking: true }),
	// Server-side persistence for authenticated users
	...(authStore.isAuthenticated && { chatId, messageId: assistantMsg.id }),
}),
```

b) In the `finally` block (~line 256-268), only save for guest users:

```ts
finally {
	loading = false;
	// Server handles persistence for authenticated users (via tee).
	// Only save client-side for guests.
	if (chatId && assistantMsg.content && !authStore.isAuthenticated) {
		chatStore.addMessage(chatId, {
			id: assistantMsg.id,
			role: assistantMsg.role,
			content: assistantMsg.content,
			reasoning: assistantMsg.reasoning,
			modelName: assistantMsg.modelName,
			isError: assistantMsg.isError,
		});
	}
}
```

**Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: send chatId/messageId to server, skip client-side assistant save for auth users"
```

---

### Task 4: Handle duplicate message conflict

The server uses `upsert` (insert or update) on the `messages` table keyed by `id`. This handles the case where the client already created the message row before the server finishes. But we need to make sure the messages table allows upserts properly.

**Files:**
- Check: `supabase/migrations/20260426120002_messages.sql` — the `id` column is already the primary key, so `upsert` on `id` works out of the box with Supabase.

No code changes needed — Supabase's `upsert` uses the primary key by default.

**Step 1: Verify by checking the migration**

The messages table has `id uuid primary key default gen_random_uuid()`. Supabase's `.upsert()` uses the primary key for conflict resolution. If the row exists, it updates. If not, it inserts. This is exactly what we need.

---

### Task 5: Test the full flow

**Step 1: Test normal flow (authenticated)**
1. Sign in with Google
2. Send a message
3. Wait for response to complete
4. Refresh the page
5. Verify: the chat, user message, AND assistant response all load from Supabase

**Step 2: Test refresh mid-stream (authenticated)**
1. Send a message with a prompt that produces a long response
2. While the response is streaming, press Ctrl+R
3. Wait 5-10 seconds for the server to finish
4. Refresh again
5. Verify: the full assistant response is in the chat (loaded from Supabase)

**Step 3: Test guest mode (unchanged)**
1. Open incognito window
2. Send a message, wait for response
3. Verify: works as before (localStorage persistence)

**Step 4: Commit if all tests pass**

```bash
git add -A
git commit -m "test: verify server-side response persistence flow"
```
