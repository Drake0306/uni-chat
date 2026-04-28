<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import PinIcon from '@lucide/svelte/icons/pin';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import XIcon from '@lucide/svelte/icons/x';
	import { chatStore } from '$lib/stores/chats.svelte.js';
	import { filterActions, type QuickAction } from '$lib/config/quick-actions.js';
	import { formatRelative, dateBucket, type DateBucket } from '$lib/utils/relative-date.js';
	import { splitMatch } from '$lib/utils/match-highlight.js';
	import type { Chat, Message } from '$lib/types.js';

	let { open = $bindable(false) }: { open: boolean } = $props();

	// ── Search state ────────────────────────────────────────
	let searchQuery = $state('');
	let searchResults = $state<Chat[]>([]);
	let searchLoading = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	// cmdk's `value` reflects the currently-highlighted item id, NOT the input
	// text — that's what powers the preview pane.
	let highlightedValue = $state<string>('');

	// `>` prefix routes the query to actions only (Linear/Slack convention).
	const isCommandMode = $derived(searchQuery.trimStart().startsWith('>'));
	const effectiveQuery = $derived(
		isCommandMode ? searchQuery.trimStart().slice(1).trim() : searchQuery.trim()
	);

	const filteredActions = $derived(filterActions(effectiveQuery));

	// Server-side chat search, debounced by 300ms. Skipped in command mode
	// (we don't want chat results polluting an actions-only filter) and when
	// the query is empty (we render the default Pinned/Recent groups instead).
	$effect(() => {
		const q = effectiveQuery;
		const cmd = isCommandMode;
		untrack(() => {
			if (searchTimer) clearTimeout(searchTimer);
			if (cmd || !q) {
				searchResults = [];
				searchLoading = false;
				return;
			}
			searchLoading = true;
			searchTimer = setTimeout(async () => {
				const results = await chatStore.searchChats(q);
				if (effectiveQuery === q && !isCommandMode) {
					searchResults = results;
					searchLoading = false;
				}
			}, 300);
		});
	});

	// Reset state on close so the next open is clean.
	$effect(() => {
		if (open) return;
		untrack(() => {
			searchQuery = '';
			searchResults = [];
			searchLoading = false;
			highlightedValue = '';
		});
	});

	// ── Result computation ──────────────────────────────────
	// Pinned chats: when searching, filter the results; otherwise the store's
	// pre-computed list (capped to 10 to keep the palette tight).
	const pinnedForResults = $derived.by<Chat[]>(() => {
		if (isCommandMode) return [];
		if (effectiveQuery) return searchResults.filter((c) => c.pinned);
		return chatStore.pinnedChats.slice(0, 10);
	});

	// Non-pinned chats: search results when querying, top-30 recents when idle.
	const nonPinnedForResults = $derived.by<Chat[]>(() => {
		if (isCommandMode) return [];
		const all = effectiveQuery
			? searchResults.filter((c) => !c.pinned)
			: [...chatStore.todayChats, ...chatStore.otherChats];
		return all.slice(0, 30);
	});

	// Bucket non-pinned chats by date so the Today/Yesterday/Week/Month/Older
	// groups render as separate sections. Order is preserved within each
	// bucket (the store already returns updated_at desc).
	const bucketedChats = $derived.by(() => {
		const now = new Date();
		const buckets: Record<DateBucket, Chat[]> = {
			Today: [],
			Yesterday: [],
			'This week': [],
			'This month': [],
			Older: [],
		};
		for (const c of nonPinnedForResults) {
			buckets[dateBucket(c.updatedAt, now)].push(c);
		}
		return buckets;
	});

	const bucketOrder: DateBucket[] = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

	const isEmpty = $derived(
		filteredActions.length === 0 &&
			pinnedForResults.length === 0 &&
			nonPinnedForResults.length === 0
	);

	// Linear order of all rendered items, used to look up the currently
	// highlighted item for the preview pane and the mobile Open button.
	type Row =
		| { kind: 'action'; action: QuickAction; value: string }
		| { kind: 'chat'; chat: Chat; value: string };

	const allRows = $derived.by<Row[]>(() => {
		const rows: Row[] = [];
		for (const a of filteredActions) rows.push({ kind: 'action', action: a, value: `action-${a.id}` });
		for (const c of pinnedForResults) rows.push({ kind: 'chat', chat: c, value: `chat-${c.id}` });
		for (const b of bucketOrder) {
			for (const c of bucketedChats[b]) {
				rows.push({ kind: 'chat', chat: c, value: `chat-${c.id}` });
			}
		}
		return rows;
	});

	const highlightedRow = $derived.by<Row | undefined>(() => {
		if (!highlightedValue) return allRows[0];
		return allRows.find((r) => r.value === highlightedValue) ?? allRows[0];
	});

	// ── Preview pane (desktop only) ─────────────────────────
	// Cache fetched messages per chat-id so arrowing back and forth doesn't
	// re-hit the network. Cache is keyed by chatId; cleared on close (the
	// component unmounts the cache when `open` goes false via the reset $effect
	// — but Svelte's $state survives between opens of the same component, so
	// previewCache also survives. Cheap and harmless: same chat, same content.)
	let previewCache = $state<Record<string, Message[]>>({});
	let previewLoadingId = $state<string | null>(null);

	$effect(() => {
		const row = highlightedRow;
		if (!row || row.kind !== 'chat') return;
		const id = row.chat.id;
		untrack(() => {
			if (previewCache[id]) return;
			if (previewLoadingId === id) return;
			previewLoadingId = id;
			chatStore.fetchChatMessages(id).then((msgs) => {
				previewCache = { ...previewCache, [id]: msgs };
				if (previewLoadingId === id) previewLoadingId = null;
			});
		});
	});

	// ── Selection handlers ──────────────────────────────────
	function selectChat(chat: Chat) {
		open = false;
		goto(`/chat/${chat.id}`);
	}

	function openInNewTab(chat: Chat) {
		window.open(`/chat/${chat.id}`, '_blank', 'noopener');
	}

	async function executeAction(action: QuickAction) {
		open = false;
		await action.onSelect();
	}

	// ⌘↵ on a highlighted chat row opens it in a new tab. Listen on the
	// dialog's keydown so the binding works even though Command.Item swallows
	// the plain Enter via cmdk's onSelect.
	function handleDialogKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			const row = highlightedRow;
			if (row?.kind === 'chat') {
				e.preventDefault();
				openInNewTab(row.chat);
			}
		}
	}
</script>

<svelte:window onkeydown={open ? handleDialogKeydown : undefined} />

<Command.Dialog
	bind:open
	bind:value={highlightedValue}
	shouldFilter={false}
	class="top-0! left-0! h-svh! w-full! max-w-none! translate-x-0! translate-y-0! rounded-none! sm:top-[12vh]! sm:left-1/2! sm:h-[75vh]! sm:max-w-3xl! sm:-translate-x-1/2! sm:rounded-2xl!"
>
	<!-- Search input row (sticky top within the modal) -->
	<Command.Input
		bind:value={searchQuery}
		placeholder={isCommandMode ? 'Run a command…' : 'Search conversations and actions…'}
		class="h-14 text-base"
	/>

	<!-- Body: split into list + preview on desktop, list-only on mobile -->
	<!-- flex-1 fills the dialog between the input and the footer; on desktop
	     the dialog is fixed at 75vh so this body grows naturally within it. -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Result list. Command.List ships with a default `max-h-72` (~288px)
		     in its base classes — that cap clips most of the chats and leaves
		     the rest of the dialog looking empty. Override with max-h-none so
		     the list grows to fill the flex parent (the dialog body). -->
		<Command.List class="min-w-0 max-h-none! flex-1 overflow-y-auto sm:border-r">
			{#if searchLoading}
				<div class="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
			{:else if isEmpty}
				<div class="px-4 py-10 text-center">
					<p class="text-sm text-muted-foreground">
						{effectiveQuery
							? `No results for "${effectiveQuery}"`
							: 'No conversations or actions to show'}
					</p>
				</div>
			{:else}
				<!-- Quick actions -->
				{#if filteredActions.length > 0}
					<Command.Group heading={isCommandMode ? 'Commands' : 'Quick actions'}>
						{#each filteredActions as action (action.id)}
							{@const Icon = action.icon}
							<Command.Item
								value={`action-${action.id}`}
								onSelect={() => executeAction(action)}
								class="gap-3 px-3 py-2.5"
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
								>
									<Icon class="size-4" />
								</span>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-semibold">
										{#each splitMatch(action.label, effectiveQuery) as seg}
											{#if seg.match}<span class="text-foreground">{seg.text}</span
												>{:else}{seg.text}{/if}
										{/each}
									</span>
									<span class="truncate text-xs text-muted-foreground">{action.description}</span>
								</div>
								{#if action.shortcut}
									<kbd
										class="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block"
									>
										{action.shortcut}
									</kbd>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}

				<!-- Pinned chats -->
				{#if pinnedForResults.length > 0}
					{#if filteredActions.length > 0}
						<Command.Separator />
					{/if}
					<Command.Group heading="Pinned">
						{#each pinnedForResults as chat (chat.id)}
							<Command.Item
								value={`chat-${chat.id}`}
								onSelect={() => selectChat(chat)}
								class="gap-3 px-3 py-2.5"
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
								>
									<PinIcon class="size-4" />
								</span>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-semibold">
										{#each splitMatch(chat.title, effectiveQuery) as seg}
											{#if seg.match}<span class="text-foreground">{seg.text}</span
												>{:else}{seg.text}{/if}
										{/each}
									</span>
								</div>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{formatRelative(chat.updatedAt)}
								</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}

				<!-- Date-bucketed recent chats -->
				{#each bucketOrder as bucket (bucket)}
					{#if bucketedChats[bucket].length > 0}
						{#if filteredActions.length > 0 || pinnedForResults.length > 0 || bucketOrder.indexOf(bucket) > 0}
							<Command.Separator />
						{/if}
						<Command.Group heading={bucket}>
							{#each bucketedChats[bucket] as chat (chat.id)}
								<Command.Item
									value={`chat-${chat.id}`}
									onSelect={() => selectChat(chat)}
									class="gap-3 px-3 py-2.5"
								>
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
									>
										<MessageSquareIcon class="size-4" />
									</span>
									<div class="flex min-w-0 flex-1 flex-col">
										<span class="truncate text-sm font-semibold">
											{#each splitMatch(chat.title, effectiveQuery) as seg}
												{#if seg.match}<span class="text-foreground">{seg.text}</span
													>{:else}{seg.text}{/if}
											{/each}
										</span>
									</div>
									<span class="ml-auto shrink-0 text-xs text-muted-foreground">
										{formatRelative(chat.updatedAt)}
									</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				{/each}
			{/if}
		</Command.List>

		<!-- Preview pane (desktop only) -->
		<aside class="hidden w-80 shrink-0 flex-col bg-muted/20 sm:flex">
			{#if !highlightedRow}
				<div class="flex flex-1 items-center justify-center p-6 text-center">
					<p class="text-sm text-muted-foreground">
						Search for a chat or action…
					</p>
				</div>
			{:else if highlightedRow.kind === 'action'}
				{@const Icon = highlightedRow.action.icon}
				<div class="flex flex-1 flex-col p-6">
					<span
						class="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-foreground"
					>
						<Icon class="size-6" />
					</span>
					<h3 class="text-base font-semibold">{highlightedRow.action.label}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{highlightedRow.action.description}</p>
					{#if highlightedRow.action.shortcut}
						<div class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
							<span>Shortcut</span>
							<kbd
								class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]"
							>
								{highlightedRow.action.shortcut}
							</kbd>
						</div>
					{/if}
				</div>
			{:else}
				{@const chat = highlightedRow.chat}
				{@const messages = previewCache[chat.id]}
				{@const isLoading = previewLoadingId === chat.id && !messages}
				<div class="flex flex-1 flex-col overflow-y-auto p-5">
					<h3 class="text-base font-semibold leading-snug">{chat.title}</h3>
					<div
						class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
					>
						<span>{formatRelative(chat.updatedAt)}</span>
						{#if messages}
							<span>· {messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
						{/if}
						{#if chat.pinned}
							<span class="flex items-center gap-1">
								·
								<PinIcon class="size-3" />
								Pinned
							</span>
						{/if}
					</div>

					{#if isLoading}
						<p class="mt-6 text-xs text-muted-foreground">Loading preview…</p>
					{:else if messages && messages.length > 0}
						<div class="mt-5 space-y-4">
							<div>
								<p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									First message
								</p>
								<p class="mt-1 line-clamp-4 text-xs text-foreground/80">
									{messages[0].content || '(empty)'}
								</p>
							</div>
							{#if messages.length > 1}
								<div>
									<p
										class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
									>
										Latest reply
									</p>
									<p class="mt-1 line-clamp-4 text-xs text-foreground/80">
										{messages[messages.length - 1].content || '(empty)'}
									</p>
								</div>
							{/if}
						</div>
					{:else if messages}
						<p class="mt-6 text-xs text-muted-foreground">No messages yet.</p>
					{/if}
				</div>
			{/if}
		</aside>
	</div>

	<!-- Footer: keyboard hints on desktop, primary action button on mobile -->
	<div class="border-t bg-muted/30 px-3 py-2 sm:px-4">
		<!-- Desktop hints -->
		<div class="hidden items-center justify-between text-[11px] text-muted-foreground sm:flex">
			<div class="flex items-center gap-3">
				<span class="flex items-center gap-1">
					<kbd class="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
					navigate
				</span>
				<span class="flex items-center gap-1">
					<kbd class="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
					open
				</span>
				<span class="flex items-center gap-1">
					<kbd class="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">⌘↵</kbd>
					new tab
				</span>
			</div>
			<div class="flex items-center gap-3">
				<span class="flex items-center gap-1">
					<kbd class="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">&gt;</kbd>
					commands
				</span>
				<span class="flex items-center gap-1">
					<kbd class="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">esc</kbd>
					close
				</span>
			</div>
		</div>

		<!-- Mobile dismiss. Rows tap-to-open inline, so the bottom button is
		     a safety/clarity exit rather than a primary CTA. -->
		<button
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:hidden"
			onclick={() => (open = false)}
		>
			<XIcon class="size-4" />
			Close
		</button>
	</div>
</Command.Dialog>

<!-- Override Command.Input's defaults: shadcn-svelte's Command.Input wraps
     the input in an InputGroup that hard-codes `h-8!` (32px) with rounded-lg
     and the inner input defaults to text-sm (14px). That makes the palette's
     search bar feel small. Bump it to a 48px field with text-base (16px) so
     it visually matches the chat textarea. Scoped to data-slot attributes
     so it affects Command.Input only. -->
<style>
	:global([data-slot='command-input-wrapper']) {
		padding: 0.625rem 0.75rem 0.5rem 0.75rem;
	}
	:global([data-slot='command-input-wrapper'] [data-slot='input-group']) {
		height: 3rem !important;
		border-radius: 0.75rem !important;
	}
	:global([data-slot='command-input']) {
		font-size: 1rem !important;
	}
</style>
