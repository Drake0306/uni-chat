<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { commandStore } from '$lib/stores/command.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { chatStore } from '$lib/stores/chats.svelte.js';
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
</script>

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

	<Separator class="mx-2" />

	<!-- Chat history -->
	<Sidebar.SidebarContent>
		<Sidebar.SidebarGroup>
			<Sidebar.SidebarGroupLabel>Recent</Sidebar.SidebarGroupLabel>
			<Sidebar.SidebarGroupContent>
				<Sidebar.SidebarMenu>
					{#each chatStore.chats as chat}
						{@const isActive = page.url.pathname === `/chat/${chat.id}`}
						<Sidebar.SidebarMenuItem>
							<Sidebar.SidebarMenuButton class={isActive ? 'bg-sidebar-accent' : ''}>
								{#snippet child({ props })}
									<a {...props} href="/chat/{chat.id}">
										<MessageSquareIcon class="size-4" />
										<span>{chat.title}</span>
									</a>
								{/snippet}
							</Sidebar.SidebarMenuButton>
							<Sidebar.SidebarMenuAction>
								<button
									class="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/menu-item:opacity-100"
									onclick={() => deleteChat(chat.id)}
								>
									<TrashIcon class="size-3" />
								</button>
							</Sidebar.SidebarMenuAction>
						</Sidebar.SidebarMenuItem>
					{/each}
					{#if chatStore.chats.length === 0}
						<div class="px-3 py-4 text-center text-sm text-muted-foreground">
							No conversations yet
						</div>
					{/if}
				</Sidebar.SidebarMenu>
			</Sidebar.SidebarGroupContent>
		</Sidebar.SidebarGroup>
	</Sidebar.SidebarContent>

	<!-- Footer: Auth -->
	<Sidebar.SidebarFooter>
		<Separator class="mx-2 mb-1" />
		<div class="px-2 pb-1">
			{#if authStore.loading}
				<Skeleton class="h-10 w-full rounded-lg" />
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
						<DropdownMenu.Item onSelect={() => {}}>
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
	</Sidebar.SidebarFooter>

	<Sidebar.SidebarRail />
</Sidebar.Sidebar>

<!-- Command palette (Cmd+K / Ctrl+K) -->
<Command.Dialog bind:open={commandStore.open} class="sm:max-w-xl! max-w-[calc(100%-2rem)]!">
	<Command.Input placeholder="Search conversations..." class="h-12 text-base" />
	<Command.List class="max-h-[400px]">
		<Command.Empty>No conversations found.</Command.Empty>
		<Command.Group heading="Recent Chats">
			{#each chatStore.chats as chat}
				<Command.Item onSelect={() => selectChat(chat)} class="py-3 text-sm">
					<MessageSquareIcon class="mr-2 size-4" />
					<span>{chat.title}</span>
				</Command.Item>
			{/each}
		</Command.Group>
	</Command.List>
</Command.Dialog>
