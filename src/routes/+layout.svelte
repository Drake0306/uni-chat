<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SyncPromptDialog from '$lib/components/sync-prompt-dialog.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	// Side-effect import: applies the persisted theme to <html> before any
	// route mounts so the first paint after refresh matches the user's choice.
	import '$lib/stores/theme.svelte.js';

	let { children } = $props();

	// Settings is a full-viewport route — opt out of the app sidebar so the
	// page can render its own left rail without competing chrome.
	const fullViewport = $derived(page.url.pathname.startsWith('/settings'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Uni Chat</title>
</svelte:head>

{#if fullViewport}
	{@render children()}
{:else}
	<Sidebar.SidebarProvider>
		<AppSidebar />
		<Sidebar.SidebarInset>
			{@render children()}
		</Sidebar.SidebarInset>
	</Sidebar.SidebarProvider>
{/if}

<SyncPromptDialog />
