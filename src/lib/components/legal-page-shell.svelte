<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import { themeStore, type Theme } from '$lib/stores/theme.svelte.js';

	let { title, lastUpdated, current, children } = $props<{
		title: string;
		lastUpdated: string;
		current: 'privacy' | 'terms';
		children: () => unknown;
	}>();

	function cycleTheme() {
		const t = themeStore.value;
		const next: Theme = t === 'light' ? 'dark' : t === 'dark' ? 'auto' : 'light';
		themeStore.set(next);
	}

	const links = [
		{ id: 'privacy', label: 'Privacy Policy', href: '/privacy-policy', icon: ShieldIcon },
		{ id: 'terms', label: 'Terms of Service', href: '/terms-of-service', icon: ScrollTextIcon },
	] as const;
</script>

<div class="min-h-screen bg-background text-foreground">
	<div class="mx-auto max-w-3xl px-6 py-8">
		<!-- Top bar — Back, the two legal-doc menu items, and theme toggle. -->
		<div class="mb-10 flex items-center justify-between gap-4">
			<button
				class="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
				onclick={() => (history.length > 1 ? history.back() : goto('/'))}
			>
				<ArrowLeftIcon class="size-4" />
				Back
			</button>

			<nav class="flex items-center gap-1" aria-label="Legal documents">
				{#each links as link (link.id)}
					{@const isActive = link.id === current}
					{@const Icon = link.icon}
					<a
						href={link.href}
						aria-current={isActive ? 'page' : undefined}
						class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors
							{isActive
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
					>
						<Icon class="size-3.5" />
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}
			</nav>

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
		</div>

		<header class="mb-10">
			<h1 class="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
			<p class="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
		</header>

		<article
			class="prose prose-neutral max-w-none dark:prose-invert
				prose-headings:scroll-mt-20 prose-headings:font-semibold
				prose-h2:mt-10 prose-h2:text-xl
				prose-h3:mt-8 prose-h3:text-lg
				prose-p:leading-relaxed
				prose-a:text-primary prose-a:no-underline hover:prose-a:underline
				prose-strong:text-foreground"
		>
			{@render children()}
		</article>
	</div>
</div>
