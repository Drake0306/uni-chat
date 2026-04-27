<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import InfoIcon from '@lucide/svelte/icons/info';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { themeStore, type Theme } from '$lib/stores/theme.svelte.js';

	let { children } = $props();

	type TabId =
		| 'account'
		| 'customization'
		| 'history'
		| 'models'
		| 'api-keys'
		| 'attachments'
		| 'shortcuts'
		| 'contact';

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'account', label: 'Account' },
		{ id: 'customization', label: 'Customization' },
		{ id: 'history', label: 'History & Sync' },
		{ id: 'models', label: 'Models' },
		{ id: 'api-keys', label: 'API Keys' },
		{ id: 'attachments', label: 'Attachments' },
		{ id: 'shortcuts', label: 'Shortcuts' },
		{ id: 'contact', label: 'Contact Us' },
	];

	// Active tab is derived from the URL — sub-routes under /settings/models/
	// keep the Models tab highlighted; the index page reads ?tab= from the
	// query string. Both pages stay in sync without prop-drilling.
	const activeTab = $derived.by<TabId>(() => {
		const path = page.url.pathname;
		if (path.startsWith('/settings/models')) return 'models';
		const fromQuery = page.url.searchParams.get('tab') as TabId | null;
		const valid: TabId[] = [
			'account',
			'customization',
			'history',
			'models',
			'api-keys',
			'attachments',
			'shortcuts',
			'contact',
		];
		return fromQuery && valid.includes(fromQuery) ? fromQuery : 'account';
	});

	function goToTab(id: TabId) {
		goto(id === 'account' ? '/settings' : `/settings?tab=${id}`);
	}

	// ── Auth gate ───────────────────────────────────────────
	$effect(() => {
		if (!authStore.loading && !authStore.isAuthenticated) {
			goto('/', { replaceState: true });
		}
	});

	// ── Theme cycle ─────────────────────────────────────────
	function cycleTheme() {
		const t = themeStore.value;
		const next: Theme = t === 'light' ? 'dark' : t === 'dark' ? 'auto' : 'light';
		themeStore.set(next);
	}

	// ── Sign out ────────────────────────────────────────────
	async function handleSignOut() {
		await authStore.signOut();
		goto('/', { replaceState: true });
	}

	// ── Derived display values for the left rail ────────────
	const tierLabel = $derived(
		authStore.tier ? `${authStore.tier[0].toUpperCase()}${authStore.tier.slice(1)} Plan` : ''
	);
	const initials = $derived(authStore.displayName?.[0]?.toUpperCase() ?? '?');
</script>

{#if !authStore.loading && authStore.isAuthenticated}
	<div class="min-h-screen bg-background text-foreground">
		<div class="mx-auto max-w-7xl px-6 py-8">
			<div class="grid gap-8 md:grid-cols-[280px_1fr]">
				<!-- ─────── Left rail ─────── -->
				<aside class="space-y-4 md:sticky md:top-8 md:self-start">
					<!-- Profile card -->
					<div class="rounded-xl border bg-card p-6 text-center">
						{#if authStore.avatarUrl}
							<img
								src={authStore.avatarUrl}
								alt=""
								class="mx-auto size-24 rounded-full object-cover"
							/>
						{:else}
							<div
								class="mx-auto flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground"
							>
								{initials}
							</div>
						{/if}
						<h2 class="mt-4 text-xl font-bold">{authStore.displayName}</h2>
						<p class="mt-1 truncate text-sm text-muted-foreground">
							{authStore.user?.email ?? ''}
						</p>
						<p class="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{tierLabel}
						</p>
					</div>

					<!-- Usage Limits -->
					<div class="rounded-xl border bg-card p-4">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold">Usage Limits</h3>
							<InfoIcon class="size-4 text-muted-foreground" />
						</div>
						<div class="mt-4">
							<p class="text-xs font-medium">Base</p>
							<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div class="h-full w-[35%] rounded-full bg-primary"></div>
							</div>
						</div>
					</div>

					<!-- Keyboard Shortcuts -->
					<div class="rounded-xl border bg-card p-4">
						<h3 class="text-sm font-semibold">Keyboard Shortcuts</h3>
						<ul class="mt-3 space-y-2.5 text-sm">
							<li class="flex items-center justify-between">
								<span>Search</span>
								<kbd
									class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
								>
									⌘ K
								</kbd>
							</li>
						</ul>
					</div>
				</aside>

				<!-- ─────── Right column ─────── -->
				<main class="min-w-0">
					<!-- Top bar -->
					<div class="mb-8 flex items-center justify-between">
						<button
							class="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
							onclick={() => goto('/')}
						>
							<ArrowLeftIcon class="size-4" />
							Back to Chat
						</button>
						<div class="flex items-center gap-2">
							<button
								class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								onclick={cycleTheme}
								title={`Theme: ${themeStore.value}`}
								aria-label="Cycle theme"
							>
								{#if themeStore.value === 'dark'}
									<MoonIcon class="size-4" />
								{:else if themeStore.value === 'light'}
									<SunIcon class="size-4" />
								{:else}
									<MonitorIcon class="size-4" />
								{/if}
							</button>
							<button
								class="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
								onclick={handleSignOut}
							>
								Sign out
							</button>
						</div>
					</div>

					<!-- Tab strip -->
					<div class="mb-8 flex flex-wrap items-center gap-1.5">
						{#each tabs as tab (tab.id)}
							{@const isActive = activeTab === tab.id}
							<button
								class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all
									{isActive
									? 'border border-border bg-card text-foreground shadow-sm'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
								onclick={() => goToTab(tab.id)}
							>
								{tab.label}
							</button>
						{/each}
					</div>

					{@render children()}
				</main>
			</div>
		</div>
	</div>
{/if}
