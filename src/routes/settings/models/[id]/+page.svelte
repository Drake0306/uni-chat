<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LinkIcon from '@lucide/svelte/icons/link';
	import StarIcon from '@lucide/svelte/icons/star';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ImageIcon from '@lucide/svelte/icons/image';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import BeakerIcon from '@lucide/svelte/icons/beaker';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import SigmaIcon from '@lucide/svelte/icons/sigma';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import Icon from '$lib/components/icon.svelte';
	import { companies, PROVIDERS, type Model } from '$lib/config/models.js';
	import { selectionsStore } from '$lib/stores/model-selections.svelte.js';

	type Benchmarks = {
		intelligenceIndex?: number;
		codingIndex?: number;
		mathIndex?: number;
		mmluPro?: number;
		gpqa?: number;
		scicode?: number;
		livecodebench?: number;
		math500?: number;
		aime?: number;
	};

	const modelId = $derived(page.params.id);
	const model = $derived(
		companies.flatMap((c) => c.models).find((m) => m.id === modelId)
	);

	let benchmarks = $state<Benchmarks | null>(null);
	let benchmarksLoaded = $state(false);

	// Fetch benchmark data once we know the model. Refetches on modelId change
	// (e.g., user navigates between detail pages without unmount).
	$effect(() => {
		const slug = model?.aaSlug;
		benchmarks = null;
		benchmarksLoaded = false;
		if (!slug) {
			benchmarksLoaded = true;
			return;
		}
		fetch(`/api/benchmarks?slug=${encodeURIComponent(slug)}`)
			.then((r) => r.json())
			.then((data) => {
				benchmarks = data.benchmarks ?? null;
				benchmarksLoaded = true;
			})
			.catch(() => {
				benchmarks = null;
				benchmarksLoaded = true;
			});
	});

	function formatDate(iso?: string): string {
		if (!iso) return '—';
		if (iso === 'live') return 'Live';
		const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!m) return iso;
		return `${m[3]}/${m[2]}/${m[1]}`;
	}

	let copied = $state(false);
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard API not available — silently ignore.
		}
	}

	function toggleStar(m: Model) {
		void selectionsStore.toggle(m.id);
	}

	const isStarred = $derived(model ? selectionsStore.has(model.id) : false);

	function priceTierColor(tier: '$' | '$$' | '$$$' | '$$$$'): string {
		if (tier === '$') return 'text-emerald-600 dark:text-emerald-400';
		if (tier === '$$') return 'text-amber-600 dark:text-amber-400';
		if (tier === '$$$') return 'text-orange-600 dark:text-orange-400';
		return 'text-rose-600 dark:text-rose-400';
	}
</script>

<svelte:head>
	<title>{model?.name ?? 'Model'} · Settings · Uni Chat</title>
</svelte:head>

<!-- Header -->
<div class="mb-4 flex items-start gap-3">
	<button
		class="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		onclick={() => goto('/settings?tab=models', { noScroll: true })}
		aria-label="Back to Models"
	>
		<ArrowLeftIcon class="size-5" />
	</button>
	<div class="min-w-0">
		<h1 class="text-2xl font-bold">Model Details</h1>
		{#if model}
			<p class="mt-1 text-sm text-muted-foreground">
				Detailed information about {model.name}
			</p>
		{/if}
	</div>
</div>

{#if !model}
	<div class="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
		Model not found.
	</div>
{:else}
	<div class="rounded-xl border bg-card p-6">
		<!-- Title row -->
		<div class="flex items-start gap-4">
			<Icon name={model.icon} class="size-12 shrink-0 rounded-lg" />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-xl font-bold">{model.name}</h2>
					{#if model.priceTier}
						<span class="font-mono text-sm font-bold {priceTierColor(model.priceTier)}">
							{model.priceTier}
						</span>
					{/if}
					{#if model.free}
						<span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
							Free
						</span>
					{/if}
					{#if model.byok}
						<span class="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
							BYOK
						</span>
					{/if}
				</div>
				<p class="mt-1 text-sm text-muted-foreground">{model.description ?? ''}</p>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<button
					class="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={copyLink}
					title={copied ? 'Copied!' : 'Copy link'}
					aria-label="Copy link"
				>
					<LinkIcon class="size-4" />
				</button>
				<button
					class="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent"
					onclick={() => toggleStar(model)}
					aria-label={isStarred ? 'Unmark recommended' : 'Mark recommended'}
				>
					<StarIcon
						class="size-4 transition-colors {isStarred
							? 'fill-amber-400 text-amber-400'
							: 'text-muted-foreground'}"
					/>
				</button>
			</div>
		</div>

		<!-- Description -->
		<div class="mt-6">
			<h3 class="text-base font-bold">Description</h3>
			<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
				{model.longDescription ?? model.description ?? 'No description available.'}
			</p>
		</div>

		<!-- Features -->
		<div class="mt-6">
			<h3 class="text-base font-bold">Features</h3>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				{#if model.capabilities.vision}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
						<EyeIcon class="size-3.5" />
						Vision
					</span>
				{/if}
				{#if model.capabilities.thinking}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
						<BrainIcon class="size-3.5" />
						Reasoning
					</span>
				{/if}
				{#if model.capabilities.thinking}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
						<SlidersHorizontalIcon class="size-3.5" />
						Effort Control
					</span>
				{/if}
				{#if model.capabilities.tools}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
						<WrenchIcon class="size-3.5" />
						Tool Calling
					</span>
				{/if}
				{#if model.capabilities.imageGeneration}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
						<ImageIcon class="size-3.5" />
						Image Generation
					</span>
				{/if}
				{#if model.capabilities.files}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-600 dark:text-pink-400">
						<FileTextIcon class="size-3.5" />
						PDF Comprehension
					</span>
				{/if}
				{#if model.capabilities.webSearch}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-400">
						<GlobeIcon class="size-3.5" />
						Web Search
					</span>
				{/if}
			</div>
		</div>

		<!-- Provider / Developer -->
		<div class="mt-6 grid grid-cols-2 gap-4">
			<div>
				<h3 class="text-sm font-bold">Provider</h3>
				<p class="mt-1 text-sm text-muted-foreground">{PROVIDERS[model.provider].name}</p>
			</div>
			<div>
				<h3 class="text-sm font-bold">Developer</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					{model.developer ?? PROVIDERS[model.provider].name}
				</p>
			</div>
		</div>

		<!-- Dates -->
		<div class="mt-6 grid grid-cols-2 gap-4">
			<div>
				<h3 class="text-sm font-bold">Knowledge Cutoff</h3>
				<p class="mt-1 text-sm text-muted-foreground">{formatDate(model.knowledgeCutoff)}</p>
			</div>
			<div>
				<h3 class="text-sm font-bold">Added On</h3>
				<p class="mt-1 text-sm text-muted-foreground">{formatDate(model.addedOn)}</p>
			</div>
		</div>

		<!-- Benchmarks -->
		<div class="mt-8">
			<div class="flex flex-wrap items-baseline gap-2">
				<h3 class="text-base font-bold">Benchmark Performance</h3>
				<a
					href="https://artificialanalysis.ai/models/{model.aaSlug ?? ''}"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					via Artificial Analysis
					<ExternalLinkIcon class="size-3" />
				</a>
			</div>

			{#if !benchmarksLoaded}
				<div class="mt-4 text-sm text-muted-foreground">Loading benchmarks…</div>
			{:else if !benchmarks}
				<div class="mt-4 rounded-lg border border-dashed bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
					Benchmark data not available for this model.
				</div>
			{:else}
				<!-- Top-level indices -->
				<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
					{#if typeof benchmarks.intelligenceIndex === 'number'}
						<div class="flex items-center justify-between rounded-lg border bg-card/50 p-4">
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
									Intelligence
								</p>
								<p class="mt-1 text-3xl font-bold text-violet-600 dark:text-violet-400">
									{benchmarks.intelligenceIndex.toFixed(1)}
								</p>
							</div>
							{@render scoreArc(benchmarks.intelligenceIndex, 'text-violet-600 dark:text-violet-400')}
						</div>
					{/if}
					{#if typeof benchmarks.codingIndex === 'number'}
						<div class="flex items-center justify-between rounded-lg border bg-card/50 p-4">
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
									Coding
								</p>
								<p class="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
									{benchmarks.codingIndex.toFixed(1)}
								</p>
							</div>
							{@render scoreArc(benchmarks.codingIndex, 'text-emerald-600 dark:text-emerald-400')}
						</div>
					{/if}
					{#if typeof benchmarks.mathIndex === 'number'}
						<div class="flex items-center justify-between rounded-lg border bg-card/50 p-4">
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
									Math
								</p>
								<p class="mt-1 text-3xl font-bold text-sky-600 dark:text-sky-400">
									{benchmarks.mathIndex.toFixed(1)}
								</p>
							</div>
							{@render scoreArc(benchmarks.mathIndex, 'text-sky-600 dark:text-sky-400')}
						</div>
					{/if}
				</div>

				<!-- Sub-benchmarks -->
				<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{@render subBenchmark('MMLU-Pro', benchmarks.mmluPro, GraduationCapIcon, 'text-violet-600 dark:text-violet-400 bg-violet-500/10')}
					{@render subBenchmark('GPQA', benchmarks.gpqa, BeakerIcon, 'text-violet-600 dark:text-violet-400 bg-violet-500/10')}
					{@render subBenchmark('SciCode', benchmarks.scicode, BeakerIcon, 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10')}
					{@render subBenchmark('LiveCodeBench', benchmarks.livecodebench, TerminalIcon, 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10')}
					{@render subBenchmark('MATH-500', benchmarks.math500, SigmaIcon, 'text-sky-600 dark:text-sky-400 bg-sky-500/10')}
					{@render subBenchmark('AIME', benchmarks.aime, CalculatorIcon, 'text-sky-600 dark:text-sky-400 bg-sky-500/10')}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Circular SVG arc — radius 14, stroke 2.5, viewBox 32x32 — -->
{#snippet scoreArc(value: number, colorClass: string)}
	{@const r = 14}
	{@const c = 2 * Math.PI * r}
	{@const clamped = Math.max(0, Math.min(100, value))}
	{@const offset = c * (1 - clamped / 100)}
	<div class="relative">
		<svg class="size-12 -rotate-90" viewBox="0 0 32 32">
			<circle
				cx="16"
				cy="16"
				r={r}
				stroke="currentColor"
				stroke-width="2.5"
				fill="none"
				class="text-muted/40"
			/>
			<circle
				cx="16"
				cy="16"
				r={r}
				stroke="currentColor"
				stroke-width="2.5"
				fill="none"
				stroke-dasharray={c}
				stroke-dashoffset={offset}
				stroke-linecap="round"
				class={colorClass}
			/>
		</svg>
		<span class="absolute inset-0 flex items-center justify-center text-xs font-semibold {colorClass}">
			{Math.round(clamped)}%
		</span>
	</div>
{/snippet}

{#snippet subBenchmark(label: string, value: number | undefined, icon: typeof GraduationCapIcon, iconClass: string)}
	{@const Icon = icon}
	<div class="flex flex-col items-start gap-1.5 rounded-lg border bg-card/30 p-3">
		<div class="flex items-center gap-2">
			<span class="flex size-7 items-center justify-center rounded-md {iconClass}">
				<Icon class="size-3.5" />
			</span>
			{#if typeof value === 'number'}
				<span class="text-lg font-bold {iconClass.split(' ').filter((c) => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')}">
					{Math.round(value)}%
				</span>
			{:else}
				<span class="text-sm text-muted-foreground">—</span>
			{/if}
		</div>
		<p class="text-xs text-muted-foreground">{label}</p>
	</div>
{/snippet}
