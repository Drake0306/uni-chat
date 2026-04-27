<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { Chat } from '$lib/types.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PinIcon from '@lucide/svelte/icons/pin';
	import PinOffIcon from '@lucide/svelte/icons/pin-off';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { commandStore } from '$lib/stores/command.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { chatStore } from '$lib/stores/chats.svelte.js';
	import { findModel, getDefaultModel } from '$lib/config/models.js';
	import GoogleIcon from '$lib/components/google-icon.svelte';

	const isMac = browser && navigator.platform.toUpperCase().includes('MAC');

	// Load chats once after auth resolves. Sign-in/out cleanup is handled
	// explicitly in the dropdown handlers below — keeping it imperative avoids
	// reactive feedback loops with the Supabase auth callback.
	let chatsLoaded = false;
	$effect(() => {
		if (!authStore.loading && !chatsLoaded) {
			chatsLoaded = true;
			chatStore.loadChats();
		}
	});

	async function handleSignOut() {
		const wasOnChat = page.url.pathname.startsWith('/chat/');
		await authStore.signOut();
		chatStore.clearActive();
		await chatStore.loadChats();
		if (wasOnChat) goto('/', { replaceState: true });
	}

	onMount(() => {
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				commandStore.open = !commandStore.open;
			}
		}
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	function selectChat(chat: { id: string }) {
		commandStore.open = false;
		goto(`/chat/${chat.id}`);
	}

	function newChat() {
		goto('/');
	}

	async function deleteChat(chatId: string) {
		const wasActive = page.url.pathname === `/chat/${chatId}`;
		await chatStore.deleteChat(chatId);
		if (wasActive) goto('/', { replaceState: true });
	}

	// Confirmation flow for permanent delete. Context-menu / future buttons set
	// chatPendingDelete; the dialog (rendered at the bottom of the file) is
	// open whenever this is non-null. Confirm runs the actual delete; cancel
	// (or escape / click-outside) just clears the state.
	let chatPendingDelete = $state<Chat | null>(null);
	let deleting = $state(false);

	async function confirmDelete() {
		if (!chatPendingDelete || deleting) return;
		const chat = chatPendingDelete;
		deleting = true;
		try {
			await deleteChat(chat.id);
			chatPendingDelete = null;
		} finally {
			deleting = false;
		}
	}

	// Context-menu actions. Only "Permanently delete" is wired today; the rest
	// are stubs for now — the user will spec the implementations later.
	function handlePin(chat: Chat) {
		if (chat.pinned) chatStore.unpinChat(chat.id);
		else chatStore.pinChat(chat.id);
	}
	function handleShare(chat: Chat) {
		console.log('[sidebar] Share (not yet implemented):', chat.id);
	}
	function handleOpenInNewTab(chat: Chat) {
		window.open(`/chat/${chat.id}`, '_blank', 'noopener');
	}
	// Rename mode: when renamingChatId matches a chat, that row renders an
	// input pre-filled with the current title (auto-focused and selected).
	// Enter commits to DB via chatStore.updateChatTitle; Escape cancels;
	// blur commits (so clicking elsewhere saves rather than dropping the edit).
	let renamingChatId = $state<string | null>(null);
	let renameValue = $state('');

	function handleRename(chat: Chat) {
		renameValue = chat.title;
		renamingChatId = chat.id;
	}

	async function commitRename(chatId: string) {
		// Guard against double-fire: Enter or Escape already cleared this, but
		// blur fires afterwards and would trigger commitRename again.
		if (renamingChatId !== chatId) return;
		const newTitle = renameValue.trim();
		renamingChatId = null;
		renameValue = '';
		if (newTitle) {
			await chatStore.updateChatTitle(chatId, newTitle);
		}
	}

	function cancelRename() {
		renamingChatId = null;
		renameValue = '';
	}

	function autofocusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	// Track in-flight title regenerations so a double-click doesn't fire twice.
	let regeneratingTitleIds = $state<Set<string>>(new Set());

	// Read the user's currently-selected model from localStorage. Same key as
	// chat-view.svelte writes to. Falls back to default if missing/invalid.
	function readSelectedModel(): { companyId: string; modelId: string; modelName: string } {
		if (typeof window === 'undefined') return getDefaultModel();
		try {
			const raw = localStorage.getItem('unichat_selected_model');
			if (raw) {
				const parsed = JSON.parse(raw) as {
					companyId?: string;
					modelId?: string;
				};
				if (parsed?.companyId && parsed?.modelId) {
					const found = findModel(parsed.companyId, parsed.modelId);
					if (found && found.enabled) {
						return {
							companyId: parsed.companyId,
							modelId: parsed.modelId,
							modelName: found.name,
						};
					}
				}
			}
		} catch {
			// fall through to default
		}
		return getDefaultModel();
	}

	async function handleRegenerateTitle(chat: Chat) {
		if (regeneratingTitleIds.has(chat.id)) return;
		regeneratingTitleIds = new Set([...regeneratingTitleIds, chat.id]);
		try {
			const allMessages = await chatStore.fetchChatMessages(chat.id);
			const usable = allMessages.filter((m) => !m.isError && m.content);
			if (usable.length === 0) return;

			// Sample: first 4 + last 2 messages (so titles stay grounded in the
			// opening topic but pick up later focus shifts on long chats).
			// Each message capped at 500 chars to keep token usage bounded.
			const head = usable.slice(0, 4);
			const tail = usable.length > 6 ? usable.slice(-2) : [];
			const sample = [...head, ...tail];
			const conversationText = sample
				.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
				.join('\n\n');

			// Single user message — works across providers that don't honor a
			// `system` role uniformly (Gemini, etc.).
			const prompt =
				`Generate a short, concise title (4-8 words, no quotes, no trailing punctuation) ` +
				`that summarizes what this conversation is about. Respond with ONLY the title text.\n\n` +
				`Conversation:\n${conversationText}`;

			const model = readSelectedModel();
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			const token = authStore.getAccessToken();
			if (token) headers['Authorization'] = `Bearer ${token}`;

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					companyId: model.companyId,
					modelId: model.modelId,
					messages: [{ role: 'user', content: prompt }],
					// No chatId/messageId — server's tee() guard requires both, so
					// the title-generation prompt is NOT saved to the chat's history.
				}),
			});
			if (!response.ok) {
				console.error('[sidebar] regenerateTitle: API error', response.status);
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) return;
			const decoder = new TextDecoder();
			let buffer = '';
			let title = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6).trim();
					if (data === '[DONE]') break;
					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta;
						if (delta?.content) title += delta.content;
					} catch {
						// skip unparseable chunks
					}
				}
			}

			// LLMs love to wrap titles in quotes and trail punctuation. Clean.
			title = title
				.trim()
				.replace(/^["'`]+|["'`]+$/g, '')
				.replace(/[.!?]+$/g, '')
				.trim()
				.slice(0, 80);

			if (title) {
				await chatStore.updateChatTitle(chat.id, title);
			}
		} catch (err) {
			console.error('[sidebar] regenerateTitle failed:', err);
		} finally {
			const next = new Set(regeneratingTitleIds);
			next.delete(chat.id);
			regeneratingTitleIds = next;
		}
	}

	// Static placeholder titles for the blur-fade loading state. Varied widths
	// so the blurred rows don't read as a uniform stack of identical bars.
	const placeholderTitles = [
		'Comparing GPT-OSS vs Llama 3.3',
		'Recipe ideas for tonight',
		'Debugging a Svelte effect loop',
		'Travel planning for Tokyo',
		'Cover letter draft review',
		'Quick algebra question',
	];

	// Two independent lists from the store. The store handles the today/older
	// split server-side and exposes them as separate $state arrays.
	const hasAnyChats = $derived(
		chatStore.pinnedChats.length > 0 ||
			chatStore.todayChats.length > 0 ||
			chatStore.otherChats.length > 0
	);

	// IntersectionObserver on the Others list sentinel: lazy-load older chats.
	let sentinel: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) chatStore.loadMoreOtherChats();
			},
			{ rootMargin: '120px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	// Server-side search for the Cmd+K palette. Debounced 300ms.
	let searchQuery = $state('');
	let searchResults = $state<Chat[]>([]);
	let searchLoading = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	// Split search results so the palette can render Pinned and Other groups.
	const searchPinned = $derived(searchResults.filter((c) => c.pinned));
	const searchOther = $derived(searchResults.filter((c) => !c.pinned));

	// Top recents shown when the search is empty (excludes pinned, shown separately).
	const recentForPalette = $derived(
		[...chatStore.todayChats, ...chatStore.otherChats].slice(0, 10)
	);

	$effect(() => {
		const q = searchQuery;
		untrack(() => {
			if (searchTimer) clearTimeout(searchTimer);
			if (!q.trim()) {
				searchResults = [];
				searchLoading = false;
				return;
			}
			searchLoading = true;
			searchTimer = setTimeout(async () => {
				const results = await chatStore.searchChats(q);
				if (searchQuery === q) {
					searchResults = results;
					searchLoading = false;
				}
			}, 300);
		});
	});

	// Reset search when the palette closes.
	$effect(() => {
		if (commandStore.open) return;
		untrack(() => {
			searchQuery = '';
			searchResults = [];
			searchLoading = false;
		});
	});
</script>

{#snippet placeholderRow(title: string)}
	<Sidebar.SidebarMenuItem>
		<div class="flex h-9 items-center pl-5 pr-12 text-[15px]" aria-hidden="true">
			<span class="truncate">{title}</span>
		</div>
	</Sidebar.SidebarMenuItem>
{/snippet}

{#snippet chatRow(chat: Chat)}
	{#if renamingChatId === chat.id}
		<Sidebar.SidebarMenuItem>
			<input
				use:autofocusSelect
				bind:value={renameValue}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						commitRename(chat.id);
					} else if (e.key === 'Escape') {
						e.preventDefault();
						cancelRename();
					}
				}}
				onblur={() => commitRename(chat.id)}
				class="block h-9 w-full rounded-md bg-background px-5 text-[15px] text-foreground outline-none ring-2 ring-sidebar-ring"
			/>
		</Sidebar.SidebarMenuItem>
	{:else}
	{@const isActive = page.url.pathname === `/chat/${chat.id}`}
	<ContextMenu.Root>
		<ContextMenu.Trigger>
			{#snippet child({ props })}
				<Sidebar.SidebarMenuItem {...props}>
					<Sidebar.SidebarMenuButton
						isActive={isActive}
						class="h-9 pl-5 pr-12 text-[15px]"
					>
						{#snippet child({ props: btnProps })}
							<a {...btnProps} href="/chat/{chat.id}">
								<span
									class="transition-[filter,opacity] duration-500 ease-out"
									class:blur-md={regeneratingTitleIds.has(chat.id)}
									class:opacity-60={regeneratingTitleIds.has(chat.id)}
								>
									{chat.title}
								</span>
							</a>
						{/snippet}
					</Sidebar.SidebarMenuButton>
					<Sidebar.SidebarMenuAction
						showOnHover
						onclick={() => handlePin(chat)}
						aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}
						class="top-1 right-1.5 size-7 -translate-x-1 rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-sidebar-border transition-all duration-150 ease-out hover:bg-sidebar-accent hover:text-foreground group-hover/menu-item:translate-x-0"
					>
						{#if chat.pinned}
							<PinOffIcon class="size-4" />
						{:else}
							<PinIcon class="size-4" />
						{/if}
					</Sidebar.SidebarMenuAction>
				</Sidebar.SidebarMenuItem>
			{/snippet}
		</ContextMenu.Trigger>
		<ContextMenu.Content class="w-56">
			<ContextMenu.Item onSelect={() => handlePin(chat)}>
				{#if chat.pinned}
					<PinOffIcon class="mr-2 size-4" />
					Unpin
				{:else}
					<PinIcon class="mr-2 size-4" />
					Pin
				{/if}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={() => handleShare(chat)}>
				<Share2Icon class="mr-2 size-4" />
				Share
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={() => handleOpenInNewTab(chat)}>
				<ExternalLinkIcon class="mr-2 size-4" />
				Open in new tab
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item onSelect={() => handleRename(chat)}>
				<PencilIcon class="mr-2 size-4" />
				Rename
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={() => handleRegenerateTitle(chat)}>
				<RefreshCwIcon class="mr-2 size-4" />
				Regenerate title
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item variant="destructive" onSelect={() => (chatPendingDelete = chat)}>
				<TrashIcon class="mr-2 size-4" />
				Permanently delete
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
	{/if}
{/snippet}

<Sidebar.Sidebar collapsible="offcanvas">
	<Sidebar.SidebarHeader>
		<div class="flex items-center px-2 pt-2">
			<Sidebar.SidebarTrigger class="size-9!" />
			<span class="flex-1 text-center text-lg font-semibold">Uni Chat</span>
			<div class="size-9"></div>
		</div>

		<div class="px-2 pb-1">
			<Button variant="outline" class="w-full justify-start gap-2 text-sm font-semibold" onclick={newChat}>
				<PlusIcon class="size-4" />
				New Chat
			</Button>
		</div>

		<div class="px-2 pb-1">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex h-8 w-full items-center gap-2 rounded-lg bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onclick={() => commandStore.open = true}
						>
							<SearchIcon class="size-3.5 shrink-0" />
							<span class="flex-1 text-left">Search chats...</span>
							<kbd class="pointer-events-none flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
								{isMac ? '⌘' : 'Ctrl'}K
							</kbd>
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right">
					{isMac ? '⌘K' : 'Ctrl+K'} to search
				</Tooltip.Content>
			</Tooltip.Root>
		</div>
	</Sidebar.SidebarHeader>

	<div class="px-2">
		<Separator />
	</div>

	<!-- Chat history -->
	<Sidebar.SidebarContent>
		<div
			class="transition-[filter,opacity] duration-500 ease-out"
			class:blur-md={chatStore.initialLoading}
			class:opacity-60={chatStore.initialLoading}
		>
			{#if chatStore.initialLoading}
				<Sidebar.SidebarGroup class="pb-1">
					<Sidebar.SidebarGroupLabel>Today</Sidebar.SidebarGroupLabel>
					<Sidebar.SidebarGroupContent>
						<Sidebar.SidebarMenu>
							{#each placeholderTitles as title (title)}
								{@render placeholderRow(title)}
							{/each}
						</Sidebar.SidebarMenu>
					</Sidebar.SidebarGroupContent>
				</Sidebar.SidebarGroup>
			{:else}
				{#if chatStore.pinnedChats.length > 0}
					<Sidebar.SidebarGroup class="pb-1">
						<Sidebar.SidebarGroupLabel>Pinned</Sidebar.SidebarGroupLabel>
						<Sidebar.SidebarGroupContent>
							<Sidebar.SidebarMenu>
								{#each chatStore.pinnedChats as chat (chat.id)}
									{@render chatRow(chat)}
								{/each}
							</Sidebar.SidebarMenu>
						</Sidebar.SidebarGroupContent>
					</Sidebar.SidebarGroup>
				{/if}

				{#if chatStore.todayChats.length > 0}
					<Sidebar.SidebarGroup class="{chatStore.pinnedChats.length > 0 ? 'mt-3' : ''} pb-1">
						<Sidebar.SidebarGroupLabel>Today</Sidebar.SidebarGroupLabel>
						<Sidebar.SidebarGroupContent>
							<Sidebar.SidebarMenu>
								{#each chatStore.todayChats as chat (chat.id)}
									{@render chatRow(chat)}
								{/each}
							</Sidebar.SidebarMenu>
						</Sidebar.SidebarGroupContent>
					</Sidebar.SidebarGroup>
				{/if}

				{#if chatStore.otherChats.length > 0}
					<Sidebar.SidebarGroup class="mt-3 pb-1">
						<Sidebar.SidebarGroupLabel>Others</Sidebar.SidebarGroupLabel>
						<Sidebar.SidebarGroupContent>
							<Sidebar.SidebarMenu>
								{#each chatStore.otherChats as chat (chat.id)}
									{@render chatRow(chat)}
								{/each}
							</Sidebar.SidebarMenu>
						</Sidebar.SidebarGroupContent>
					</Sidebar.SidebarGroup>
				{/if}

				{#if !hasAnyChats}
					<div class="px-3 py-4 text-center text-sm text-muted-foreground">
						No conversations yet
					</div>
				{/if}

				{#if chatStore.othersHasMore}
					<div bind:this={sentinel} class="flex h-10 items-center justify-center text-xs text-muted-foreground">
						{chatStore.othersLoadingMore ? 'Loading…' : ''}
					</div>
				{/if}
			{/if}
		</div>
	</Sidebar.SidebarContent>

	<!-- Footer: Auth -->
	<Sidebar.SidebarFooter>
		<div class="mb-1 px-2">
			<Separator />
		</div>
		<div class="px-2 pb-1">
			<div
				class="transition-[filter,opacity] duration-500 ease-out"
				class:blur-md={authStore.loading}
				class:opacity-60={authStore.loading}
			>
				{#if authStore.loading}
					<div
						class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
						aria-hidden="true"
					>
						<div class="size-7 rounded-full bg-primary"></div>
						<div class="flex flex-1 flex-col truncate">
							<span class="truncate text-sm font-semibold">Loading account</span>
							<span class="text-xs capitalize text-muted-foreground">free plan</span>
						</div>
					</div>
				{:else if authStore.isAuthenticated}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
								>
									{#if authStore.avatarUrl}
										<img src={authStore.avatarUrl} alt="" class="size-7 rounded-full" />
									{:else}
										<div class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
											{authStore.displayName?.[0]?.toUpperCase() ?? '?'}
										</div>
									{/if}
									<div class="flex flex-1 flex-col truncate">
										<span class="truncate text-sm font-semibold">{authStore.displayName}</span>
										<span class="text-xs capitalize text-muted-foreground">{authStore.tier} plan</span>
									</div>
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start" side="top" class="w-48" sideOffset={8}>
							<DropdownMenu.Item onSelect={() => goto('/settings')}>
								<SettingsIcon class="mr-2 size-4" />
								Settings
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onSelect={handleSignOut} variant="destructive">
								<LogOutIcon class="mr-2 size-4" />
								Sign out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{:else}
					<Button
						variant="outline"
						class="w-full justify-center gap-2 text-sm font-semibold"
						onclick={() => authStore.signInWithGoogle()}
					>
						<GoogleIcon class="size-4" />
						Sign in with Google
					</Button>
				{/if}
			</div>
		</div>
	</Sidebar.SidebarFooter>

	<Sidebar.SidebarRail />
</Sidebar.Sidebar>

<!-- Command palette (Cmd+K / Ctrl+K) -->
<Command.Dialog
	bind:open={commandStore.open}
	shouldFilter={false}
	class="sm:max-w-2xl! max-w-[calc(100%-2rem)]!"
>
	<Command.Input
		bind:value={searchQuery}
		placeholder="Search conversations..."
		class="h-14 text-base"
	/>
	<Command.List class="max-h-[480px]">
		{#if searchQuery.trim()}
			{#if searchLoading}
				<div class="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
			{:else if searchResults.length === 0}
				<Command.Empty>No conversations found.</Command.Empty>
			{:else}
				{#if searchPinned.length > 0}
					<Command.Group heading="Pinned">
						{#each searchPinned as chat (chat.id)}
							<Command.Item
								value={chat.id}
								onSelect={() => selectChat(chat)}
								class="gap-2 pl-5 py-2 text-[13px]"
							>
								<PinIcon class="size-3.5 shrink-0 text-muted-foreground" />
								<span class="truncate">{chat.title}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
				{#if searchPinned.length > 0 && searchOther.length > 0}
					<Command.Separator />
				{/if}
				{#if searchOther.length > 0}
					<Command.Group heading="Conversations">
						{#each searchOther as chat (chat.id)}
							<Command.Item
								value={chat.id}
								onSelect={() => selectChat(chat)}
								class="pl-5 py-2 text-[13px]"
							>
								<span class="truncate">{chat.title}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
			{/if}
		{:else}
			{#if chatStore.pinnedChats.length > 0}
				<Command.Group heading="Pinned">
					{#each chatStore.pinnedChats.slice(0, 10) as chat (chat.id)}
						<Command.Item
							value={chat.id}
							onSelect={() => selectChat(chat)}
							class="gap-2 pl-5 py-2 text-[13px]"
						>
							<PinIcon class="size-3.5 shrink-0 text-muted-foreground" />
							<span class="truncate">{chat.title}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}
			{#if chatStore.pinnedChats.length > 0 && recentForPalette.length > 0}
				<Command.Separator />
			{/if}
			{#if recentForPalette.length > 0}
				<Command.Group heading="Recent">
					{#each recentForPalette as chat (chat.id)}
						<Command.Item
							value={chat.id}
							onSelect={() => selectChat(chat)}
							class="pl-5 py-2 text-[13px]"
						>
							<span class="truncate">{chat.title}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}
		{/if}
	</Command.List>
</Command.Dialog>

<!-- Confirm permanent delete -->
<Dialog.Root
	open={chatPendingDelete !== null}
	onOpenChange={(o) => {
		if (!o && !deleting) chatPendingDelete = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete this chat?</Dialog.Title>
			<Dialog.Description>
				<span class="font-medium text-foreground">"{chatPendingDelete?.title ?? ''}"</span>
				and all its messages will be permanently deleted. This cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (chatPendingDelete = null)} disabled={deleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
