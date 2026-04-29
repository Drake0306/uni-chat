<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SyncPromptDialog from '$lib/components/sync-prompt-dialog.svelte';
	import SessionExpiredDialog from '$lib/components/session-expired-dialog.svelte';
	import OnboardingTour from '$lib/components/onboarding-tour.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	// Side-effect import: applies the persisted theme to <html> before any
	// route mounts so the first paint after refresh matches the user's choice.
	import '$lib/stores/theme.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { selectionsStore } from '$lib/stores/model-selections.svelte.js';

	let { children } = $props();

	// Settings is a full-viewport route — opt out of the app sidebar so the
	// page can render its own left rail without competing chrome. /login,
	// /privacy-policy, and /terms-of-service are also full-viewport.
	const fullViewport = $derived(
		page.url.pathname.startsWith('/settings') ||
			page.url.pathname.startsWith('/login') ||
			page.url.pathname.startsWith('/privacy-policy') ||
			page.url.pathname.startsWith('/terms-of-service')
	);

	// Hydrate the per-user model selections whenever auth state stabilizes.
	// Fires on initial mount (after authStore.loading flips false) and again
	// on sign-in / sign-out so the store always reflects the current user.
	$effect(() => {
		// Track both signals so the effect re-runs on either change.
		const loading = authStore.loading;
		void authStore.isAuthenticated;
		if (!loading) {
			selectionsStore.loadSelections();
		}
	});
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
<SessionExpiredDialog />
<OnboardingTour />
