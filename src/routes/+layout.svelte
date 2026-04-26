<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Uni Chat</title>
</svelte:head>

<Sidebar.SidebarProvider>
	<AppSidebar />
	<Sidebar.SidebarInset>
		{@render children()}
	</Sidebar.SidebarInset>
</Sidebar.SidebarProvider>
