<script lang="ts">
	import StarIcon from '@lucide/svelte/icons/star';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ImageIcon from '@lucide/svelte/icons/image';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import ListIcon from '@lucide/svelte/icons/list';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import KeyIcon from '@lucide/svelte/icons/key';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Icon from '$lib/components/icon.svelte';
	import { companies, capabilityLabels, type Model } from '$lib/config/models.js';
	import { selectionsStore } from '$lib/stores/model-selections.svelte.js';

	// ── Local UI state ──────────────────────────────────────────
	type View = 'list' | 'grid';
	let view = $state<View>('list');
	let search = $state('');

	// Filter dropdown state — checkboxes toggle visually but don't filter.
	let filterFast = $state(false);
	let filterVision = $state(false);
	let filterReasoning = $state(false);
	let filterEffort = $state(false);
	let filterTools = $state(false);
	let filterImageGen = $state(false);
	let filterPdf = $state(false);
	let filterFreeOnly = $state(false);
	let filterPremiumOnly = $state(false);

	// ── Derived ─────────────────────────────────────────────────
	const allModels = $derived(
		companies.flatMap((c) => c.models).filter((m) => m.enabled)
	);
	const newModels = $derived(allModels.filter((m) => m.isNew));
	const filteredModels = $derived(
		search.trim() === ''
			? allModels
			: allModels.filter((m) => {
					const q = search.toLowerCase();
					return (
						m.name.toLowerCase().includes(q) ||
						modelDescription(m).toLowerCase().includes(q)
					);
				})
	);

	function modelDescription(m: Model): string {
		// Prefer the curated description; fall back to a capability summary
		// for any model that hasn't been backfilled yet.
		return m.description ?? capabilityLabels(m.capabilities, m.contextWindow).join(' · ');
	}

	function priceTierColor(tier: '$' | '$$' | '$$$' | '$$$$'): string {
		// Subtle gradient: cheap=green, premium=red. Matches the screenshot's
		// green→amber→red feel.
		if (tier === '$') return 'text-emerald-600 dark:text-emerald-400';
		if (tier === '$$') return 'text-amber-600 dark:text-amber-400';
		if (tier === '$$$') return 'text-orange-600 dark:text-orange-400';
		return 'text-rose-600 dark:text-rose-400';
	}

	function toggleRecommend(id: string) {
		void selectionsStore.toggle(id);
	}

	function selectRecommended() {
		void selectionsStore.selectRecommended();
	}

	function unselectAll() {
		void selectionsStore.unselectAll();
	}
</script>

<!-- Header -->
<div class="mb-4 flex items-start justify-between gap-4">
	<div class="min-w-0">
		<h2 class="text-2xl font-bold">Models</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Choose which models appear in your selector, and read more about their capabilities.
		</p>
	</div>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					aria-label="More options"
				>
					<MoreHorizontalIcon class="size-4" />
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-48">
			<DropdownMenu.Item onSelect={selectRecommended}>Select recommended</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={unselectAll}>Unselect all</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<!-- New-models banner -->
{#if newModels.length > 0}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
	>
		<SparklesIcon class="mt-0.5 size-4 shrink-0 text-primary" />
		<p class="min-w-0">
			<span class="font-semibold text-primary">{newModels.length} new</span>
			<span class="text-muted-foreground"> — </span>
			<span class="text-foreground">
				{newModels
					.slice(0, 8)
					.map((m) => m.name)
					.join(', ')}{newModels.length > 8 ? '…' : ''}
			</span>
		</p>
	</div>
{/if}

<!-- Toolbar -->
<div class="mb-4 flex flex-wrap items-center gap-2">
	<div class="min-w-48 flex-1">
		<input
			bind:value={search}
			type="text"
			placeholder="Search models..."
			class="w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
		/>
	</div>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="flex items-center gap-2 rounded-lg border bg-background px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
				>
					<FilterIcon class="size-4" />
					Filter
					<ChevronDownIcon class="size-4 text-muted-foreground" />
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.CheckboxItem bind:checked={filterFast}>
				<ZapIcon class="mr-2 size-4 text-amber-500" />
				Fast
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterVision}>
				<EyeIcon class="mr-2 size-4 text-sky-500" />
				Vision
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterReasoning}>
				<BrainIcon class="mr-2 size-4 text-violet-500" />
				Reasoning
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterEffort}>
				<SlidersHorizontalIcon class="mr-2 size-4 text-blue-500" />
				Effort Control
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterTools}>
				<WrenchIcon class="mr-2 size-4 text-orange-500" />
				Tool Calling
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterImageGen}>
				<ImageIcon class="mr-2 size-4 text-rose-500" />
				Image Generation
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterPdf}>
				<FileTextIcon class="mr-2 size-4 text-pink-500" />
				PDF Comprehension
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Separator />
			<DropdownMenu.CheckboxItem bind:checked={filterFreeOnly}>
				Free tier only
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem bind:checked={filterPremiumOnly}>
				Premium only
			</DropdownMenu.CheckboxItem>
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	<!-- View toggle -->
	<div class="flex overflow-hidden rounded-lg border bg-background">
		<button
			class="flex size-10 items-center justify-center transition-colors {view === 'list'
				? 'bg-accent text-foreground'
				: 'text-muted-foreground hover:bg-accent/50'}"
			onclick={() => (view = 'list')}
			aria-label="List view"
			aria-pressed={view === 'list'}
		>
			<ListIcon class="size-4" />
		</button>
		<button
			class="flex size-10 items-center justify-center transition-colors {view === 'grid'
				? 'bg-accent text-foreground'
				: 'text-muted-foreground hover:bg-accent/50'}"
			onclick={() => (view = 'grid')}
			aria-label="Grid view"
			aria-pressed={view === 'grid'}
		>
			<LayoutGridIcon class="size-4" />
		</button>
	</div>
</div>

<!-- Capability icon set: rendered on cards/rows -->
{#snippet capabilityIcons(m: Model, size: 'sm' | 'md' = 'sm')}
	{@const cls = size === 'sm' ? 'size-3.5' : 'size-4'}
	<div class="flex flex-wrap items-center gap-1.5">
		{#if m.capabilities.vision}
			<span class="flex size-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-500" title="Vision">
				<EyeIcon class={cls} />
			</span>
		{/if}
		{#if m.capabilities.thinking}
			<span class="flex size-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-500" title="Reasoning">
				<BrainIcon class={cls} />
			</span>
		{/if}
		{#if m.capabilities.tools}
			<span class="flex size-6 items-center justify-center rounded-md bg-orange-500/10 text-orange-500" title="Tools">
				<WrenchIcon class={cls} />
			</span>
		{/if}
		{#if m.capabilities.webSearch}
			<span class="flex size-6 items-center justify-center rounded-md bg-teal-500/10 text-teal-500" title="Web search">
				<GlobeIcon class={cls} />
			</span>
		{/if}
		{#if m.capabilities.files}
			<span class="flex size-6 items-center justify-center rounded-md bg-pink-500/10 text-pink-500" title="Files">
				<FileTextIcon class={cls} />
			</span>
		{/if}
		{#if m.capabilities.imageGeneration}
			<span class="flex size-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-500" title="Image generation">
				<ImageIcon class={cls} />
			</span>
		{/if}
	</div>
{/snippet}

<!-- Recommendation star button. stopPropagation so clicking it doesn't
     also follow the row's link to the model detail page. -->
{#snippet starButton(m: Model)}
	{@const isRec = selectionsStore.has(m.id)}
	<button
		class="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleRecommend(m.id);
		}}
		aria-label={isRec ? 'Unmark recommended' : 'Mark recommended'}
	>
		<StarIcon
			class="size-4 transition-colors {isRec
				? 'fill-amber-400 text-amber-400'
				: 'text-muted-foreground'}"
		/>
	</button>
{/snippet}

<!-- Content -->
{#if filteredModels.length === 0}
	<div class="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
		No models match your search.
	</div>
{:else if view === 'list'}
	<div class="divide-y rounded-xl border bg-card">
		{#each filteredModels as m (m.id)}
			<div class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
				<a
					href="/settings/models/{m.id}"
					data-sveltekit-noscroll
					class="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-md"
				>
					<Icon name={m.icon} class="size-7 shrink-0 rounded" />
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-semibold">{m.name}</span>
							{#if m.priceTier}
								<span class="font-mono text-xs font-bold {priceTierColor(m.priceTier)}">
									{m.priceTier}
								</span>
							{/if}
							{#if m.free}
								<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
									<ZapIcon class="size-3" />
									Free
								</span>
							{/if}
							{#if m.byok}
								<span class="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
									<KeyIcon class="size-3" />
									BYOK
								</span>
							{/if}
							{#if m.isNew}
								<span class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
									New
								</span>
							{/if}
						</div>
						<p class="mt-0.5 truncate text-xs text-muted-foreground">
							{modelDescription(m)}
						</p>
					</div>
				</a>
				{@render capabilityIcons(m, 'sm')}
				{@render starButton(m)}
			</div>
		{/each}
	</div>
{:else}
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
		{#each filteredModels as m (m.id)}
			<div
				class="relative flex flex-col rounded-xl border bg-card transition-colors hover:bg-accent/30 {m.isNew
					? 'ring-1 ring-amber-500/40'
					: ''}"
			>
				{#if m.isNew}
					<span class="absolute -top-2 right-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
						New
					</span>
				{/if}
				<div class="absolute right-2 top-2 z-10">
					{@render starButton(m)}
				</div>
				<a
					href="/settings/models/{m.id}"
					data-sveltekit-noscroll
					class="flex flex-1 flex-col p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
				>
					<Icon name={m.icon} class="size-8 rounded" />
					<h3 class="mt-3 line-clamp-2 text-sm font-semibold leading-tight">{m.name}</h3>
					<div class="mt-2 flex flex-wrap items-center gap-1.5">
						{#if m.priceTier}
							<span class="font-mono text-xs font-bold {priceTierColor(m.priceTier)}">
								{m.priceTier}
							</span>
						{/if}
						{#if m.free}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
								<ZapIcon class="size-2.5" />
								Free
							</span>
						{/if}
						{#if m.byok}
							<span class="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
								<KeyIcon class="size-2.5" />
								BYOK
							</span>
						{/if}
					</div>
					<div class="mt-auto pt-3">
						{@render capabilityIcons(m, 'sm')}
					</div>
				</a>
			</div>
		{/each}
	</div>
{/if}
