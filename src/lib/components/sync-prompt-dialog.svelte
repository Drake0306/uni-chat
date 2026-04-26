<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { chatStore } from '$lib/stores/chats.svelte.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';

	let busy = $state(false);
	let errorMessage = $state<string | null>(null);
	let localChats = $state<{ id: string; title: string; messageCount: number }[]>([]);
	let selected = $state<Set<string>>(new Set());

	// Dialog open state derives directly from the auth store flag.
	// One-way binding (open={...}) is sufficient because bits-ui's `open` prop
	// is reactive in v2; we use onOpenChange for any close-back propagation.
	const dialogOpen = $derived(authStore.pendingSyncDecision);

	// Read localStorage chats when the dialog opens.
	// IMPORTANT: do not read localChats inside this effect after writing it —
	// Svelte 5 will re-schedule the effect on its own write and infinite-loop.
	// Use a local variable for the second .map() instead.
	$effect(() => {
		if (!authStore.pendingSyncDecision) return;
		const mapped = chatStore.getLocalChats().map((c) => ({
			id: c.id,
			title: c.title || 'Untitled chat',
			messageCount: c.messages.length,
		}));
		localChats = mapped;
		selected = new Set(mapped.map((c) => c.id));
	});

	const allSelected = $derived(localChats.length > 0 && selected.size === localChats.length);
	const noneSelected = $derived(selected.size === 0);

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(localChats.map((c) => c.id));
	}

	function toggleOne(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	async function sync() {
		busy = true;
		errorMessage = null;
		const wasOnLocalChat = page.url.pathname.startsWith('/chat/');
		try {
			await chatStore.migrateLocalToSupabase(Array.from(selected));
			// Success — close the dialog and redirect if needed.
			authStore.clearSyncDecision();
			if (wasOnLocalChat) goto('/', { replaceState: true });
		} catch (err) {
			// Migration failed (some or all chats). Keep the dialog open with the
			// error visible so the user can retry. Failed chats remain in localStorage.
			errorMessage = err instanceof Error ? err.message : String(err);
			// Re-read the now-pruned localStorage so the list reflects only
			// the chats that still need syncing.
			const all = chatStore.getLocalChats();
			localChats = all.map((c) => ({
				id: c.id,
				title: c.title || 'Untitled chat',
				messageCount: c.messages.length,
			}));
			selected = new Set(localChats.map((c) => c.id));
		} finally {
			busy = false;
		}
	}

	function discard() {
		busy = true;
		const wasOnLocalChat = page.url.pathname.startsWith('/chat/');
		localStorage.removeItem('unichat_chats');
		chatStore.clearActive();
		chatStore.loadChats();
		authStore.clearSyncDecision();
		if (wasOnLocalChat) goto('/', { replaceState: true });
		// `busy` doesn't need resetting — clearing pendingSyncDecision unmounts the dialog.
	}
</script>

<Dialog.Root open={dialogOpen} onOpenChange={(o) => { if (!o) authStore.clearSyncDecision(); }}>
	<Dialog.Content
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
		showCloseButton={false}
		class="sm:max-w-md"
	>
		<Dialog.Header>
			<Dialog.Title>Sync your chats?</Dialog.Title>
			<Dialog.Description>
				{localChats.length} {localChats.length === 1 ? 'chat' : 'chats'} from before sign-in. Pick which ones to keep.
			</Dialog.Description>
		</Dialog.Header>

		{#if errorMessage}
			<div class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{errorMessage}
			</div>
		{/if}

		{#if localChats.length > 0}
			<div class="-mx-2 max-h-72 overflow-y-auto rounded-md border border-border">
				<label class="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
					<input
						type="checkbox"
						checked={allSelected}
						onchange={toggleAll}
						class="size-4 rounded border-input accent-primary"
					/>
					Select all
					<span class="ml-auto text-xs font-normal text-muted-foreground">
						{selected.size} of {localChats.length}
					</span>
				</label>

				{#each localChats as chat}
					<label class="flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40">
						<input
							type="checkbox"
							checked={selected.has(chat.id)}
							onchange={() => toggleOne(chat.id)}
							class="size-4 shrink-0 rounded border-input accent-primary"
						/>
						<MessageSquareIcon class="size-4 shrink-0 text-muted-foreground" />
						<span class="flex-1 truncate">{chat.title}</span>
						<span class="text-xs text-muted-foreground">
							{chat.messageCount} {chat.messageCount === 1 ? 'msg' : 'msgs'}
						</span>
					</label>
				{/each}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="ghost" onclick={discard} disabled={busy}>Discard all</Button>
			<Button onclick={sync} disabled={busy || noneSelected}>
				{#if busy}
					Syncing...
				{:else if noneSelected}
					Sync
				{:else}
					Sync {selected.size} {selected.size === 1 ? 'chat' : 'chats'}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
