<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import InfoIcon from '@lucide/svelte/icons/info';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { customizationStore } from '$lib/stores/customization.svelte.js';
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
		// noScroll: true preserves the user's scroll position across the
		// ?tab= URL change. Without it, SvelteKit's default scroll-to-top on
		// navigation pushes the tab strip out of view on mobile (where the
		// left-rail cards stack above it), forcing a re-scroll on every tap.
		goto(id === 'account' ? '/settings' : `/settings?tab=${id}`, {
			noScroll: true,
		});
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

	// ── Mobile tab-strip scroll affordances ─────────────────
	// Show chevron indicators on the left/right of the tab strip when there
	// are tabs cut off in that direction. Hidden on desktop (where the strip
	// wraps to multiple lines and never overflows horizontally).
	let tabStripEl: HTMLDivElement | undefined = $state();
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);
	let avatarLoadFailed = $state(false);

	function checkTabScroll() {
		if (!tabStripEl) return;
		// 4px buffer absorbs sub-pixel rounding so the indicators don't flicker
		// at the extremes.
		canScrollLeft = tabStripEl.scrollLeft > 4;
		canScrollRight =
			tabStripEl.scrollLeft + tabStripEl.clientWidth < tabStripEl.scrollWidth - 4;
	}

	$effect(() => {
		if (!tabStripEl) return;
		checkTabScroll();
		const observer = new ResizeObserver(() => checkTabScroll());
		observer.observe(tabStripEl);
		return () => observer.disconnect();
	});
</script>

{#if !authStore.loading && authStore.isAuthenticated}
	<div class="min-h-screen bg-background text-foreground">
		<div class="mx-auto max-w-7xl px-6 py-8">
			<div class="grid gap-8 md:grid-cols-[280px_1fr]">
				<!-- ─────── Left rail ─────── -->
				<aside class="space-y-4 md:sticky md:top-8 md:self-start">
					<!-- Profile card. When the user has Hide Personal Info on, we
					     swap the avatar for a generic placeholder and hide name +
					     email. Tier label remains so the user still sees their
					     plan. -->
					<div class="rounded-xl border bg-card p-6 text-center">
						{#if customizationStore.hidePersonalInfo}
							<div
								class="mx-auto flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground"
							>
								?
							</div>
							<h2 class="mt-4 text-xl font-bold">Account</h2>
							<p class="mt-1 truncate text-sm text-muted-foreground">
								Personal info hidden
							</p>
						{:else if authStore.avatarUrl && !avatarLoadFailed}
							<img
								src={authStore.avatarUrl}
								alt=""
								class="mx-auto size-24 rounded-full object-cover"
								referrerpolicy="no-referrer"
								onerror={() => (avatarLoadFailed = true)}
							/>
							<h2 class="mt-4 text-xl font-bold">{authStore.displayName}</h2>
							<p class="mt-1 truncate text-sm text-muted-foreground">
								{authStore.user?.email ?? ''}
							</p>
						{:else}
							<div
								class="mx-auto flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground"
							>
								{initials}
							</div>
							<h2 class="mt-4 text-xl font-bold">{authStore.displayName}</h2>
							<p class="mt-1 truncate text-sm text-muted-foreground">
								{authStore.user?.email ?? ''}
							</p>
						{/if}
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

					<!-- Tab strip. Mobile: horizontal scroll, single row, no wrap, with
					     fade + chevron indicators that appear only when the content
					     is actually cut off in that direction. Desktop: flex-wrap
					     as before, indicators are hidden. -->
					<div class="relative mb-8">
						{#if canScrollLeft}
							<div
								class="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center bg-linear-to-r from-background to-transparent sm:hidden"
								aria-hidden="true"
							>
								<div class="flex size-7 items-center justify-center rounded-full bg-accent shadow-md ring-1 ring-border">
									<ChevronLeftIcon class="size-4 text-foreground" />
								</div>
							</div>
						{/if}
						{#if canScrollRight}
							<div
								class="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-linear-to-l from-background to-transparent sm:hidden"
								aria-hidden="true"
							>
								<div class="flex size-7 items-center justify-center rounded-full bg-accent shadow-md ring-1 ring-border">
									<ChevronRightIcon class="size-4 text-foreground" />
								</div>
							</div>
						{/if}
						<div
							class="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-x-visible"
							bind:this={tabStripEl}
							onscroll={checkTabScroll}
						>
							{#each tabs as tab (tab.id)}
								{@const isActive = activeTab === tab.id}
								<button
									class="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all sm:px-3.5
										{isActive
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'text-muted-foreground hover:bg-primary/15 hover:text-foreground'}"
									onclick={() => goToTab(tab.id)}
								>
									{tab.label}
								</button>
							{/each}
						</div>
					</div>

					{@render children()}
				</main>
			</div>
		</div>
	</div>
{/if}
