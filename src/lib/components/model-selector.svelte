<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import MinimizeIcon from '@lucide/svelte/icons/minimize-2';
	import MaximizeIcon from '@lucide/svelte/icons/maximize-2';
	import ChevronsUpIcon from '@lucide/svelte/icons/chevrons-up';
	import ChevronsDownIcon from '@lucide/svelte/icons/chevrons-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import ImageIcon from '@lucide/svelte/icons/image';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { companies, iconUrl, hasEnabledModels, capabilityLabels, PROVIDERS, type Company, type Model } from '$lib/config/models.js';

	let {
		selected = $bindable(),
		onSelect,
	}: {
		selected: { companyId: string; modelId: string; modelName: string };
		onSelect?: (model: { companyId: string; modelId: string; modelName: string }) => void;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let expanded = $state(true);
	let activeCompany = $state(companies[0]);
	let sidebarEl: HTMLDivElement | undefined = $state();
	let canScrollUp = $state(false);
	let canScrollDown = $state(false);

	function checkSidebarScroll() {
		if (!sidebarEl) return;
		canScrollUp = sidebarEl.scrollTop > 4;
		canScrollDown = sidebarEl.scrollTop + sidebarEl.clientHeight < sidebarEl.scrollHeight - 4;
	}

	$effect(() => {
		if (open && sidebarEl) {
			checkSidebarScroll();
		}
	});

	function modelLabels(m: Model): string[] {
		return capabilityLabels(m.capabilities, m.contextWindow);
	}

	const filteredModels = $derived(() => {
		const q = search.toLowerCase();
		if (!q) return activeCompany.models;
		return activeCompany.models.filter(
			(m) => m.name.toLowerCase().includes(q) || modelLabels(m).some((c) => c.toLowerCase().includes(q))
		);
	});

	const allFilteredCompanies = $derived(() => {
		if (!search) return null;
		const q = search.toLowerCase();
		return companies
			.map((c) => ({
				...c,
				models: c.models.filter(
					(m) =>
						m.name.toLowerCase().includes(q) ||
						c.name.toLowerCase().includes(q) ||
						modelLabels(m).some((cap) => cap.toLowerCase().includes(q))
				),
			}))
			.filter((c) => c.models.length > 0);
	});

	function selectModel(company: Company, model: Model) {
		if (!model.enabled) return;
		selected = { companyId: company.id, modelId: model.id, modelName: model.name };
		onSelect?.(selected);
		open = false;
		search = '';
	}
</script>

{#snippet capabilityBadges(model: Model)}
	<div class="mt-1.5 flex flex-wrap items-center gap-1">
		{#if model.capabilities.thinking}
			<Badge class="h-4 gap-0.5 border-0 bg-violet-500/15 px-1.5 text-[10px] font-medium text-violet-600"><BrainIcon class="size-2.5" />Thinking</Badge>
		{/if}
		{#if model.capabilities.vision}
			<Badge class="h-4 gap-0.5 border-0 bg-blue-500/15 px-1.5 text-[10px] font-medium text-blue-600"><EyeIcon class="size-2.5" />Vision</Badge>
		{/if}
		{#if model.capabilities.tools}
			<Badge class="h-4 gap-0.5 border-0 bg-orange-500/15 px-1.5 text-[10px] font-medium text-orange-600"><WrenchIcon class="size-2.5" />Tools</Badge>
		{/if}
		{#if model.capabilities.webSearch}
			<Badge class="h-4 gap-0.5 border-0 bg-teal-500/15 px-1.5 text-[10px] font-medium text-teal-600"><GlobeIcon class="size-2.5" />Search</Badge>
		{/if}
		{#if model.capabilities.files}
			<Badge class="h-4 gap-0.5 border-0 bg-pink-500/15 px-1.5 text-[10px] font-medium text-pink-600"><PaperclipIcon class="size-2.5" />Files</Badge>
		{/if}
		{#if model.capabilities.imageGeneration}
			<Badge class="h-4 gap-0.5 border-0 bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-600"><ImageIcon class="size-2.5" />Image</Badge>
		{/if}
		<span class="text-[10px] text-muted-foreground">{model.contextWindow} ctx</span>
	</div>
	<div class="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
		<span>via</span>
		<img
			src={iconUrl(PROVIDERS[model.provider].icon)}
			alt=""
			class="size-3"
		/>
		<span class="font-medium">{PROVIDERS[model.provider].name}</span>
	</div>
{/snippet}

<div class="w-fit">
<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="inline-flex flex-nowrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all hover:bg-accent hover:shadow-sm active:scale-[0.98]"
			>
				<span class="whitespace-nowrap text-sm font-semibold">{selected.modelName}</span>
				{#if open}
					<ChevronUpIcon class="size-4 shrink-0 text-muted-foreground" />
				{:else}
					<ChevronDownIcon class="size-4 shrink-0 text-muted-foreground" />
				{/if}
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align="start"
		side="top"
		class="w-[720px] p-0"
		sideOffset={12}
	>
		<div class="flex flex-col" style="height: {expanded ? '540px' : '320px'}; transition: height 0.2s ease;">
			<!-- Upgrade banner -->
			<div class="flex items-center justify-between bg-muted/30 px-4 py-2.5">
				<span class="text-sm text-muted-foreground">Using free tier</span>
				<div class="flex items-center gap-2">
					<button
						class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
						onclick={() => expanded = !expanded}
					>
						{#if expanded}
							<MinimizeIcon class="size-4" />
						{:else}
							<MaximizeIcon class="size-4" />
						{/if}
					</button>
					<Button variant="default" size="sm" class="h-8 gap-1.5 px-3 text-sm font-medium">
						<SparklesIcon class="size-3.5" />
						Upgrade
					</Button>
				</div>
			</div>

			<!-- Search -->
			<div class="px-4 py-2.5">
				<div class="relative">
					<SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						bind:value={search}
						placeholder="Search models..."
						class="h-10 border-0 bg-muted/40 pl-9 text-sm shadow-none focus-visible:ring-0"
					/>
				</div>
			</div>

			<!-- Body: sidebar + models -->
			<div class="flex flex-1 overflow-hidden">
				<!-- Company sidebar -->
				<div class="relative flex w-[72px] flex-col border-r bg-muted/10">
					{#if canScrollUp}
						<div class="absolute inset-x-0 top-0 z-10 flex justify-center py-1">
							<div class="flex size-6 items-center justify-center rounded-full bg-accent shadow-md">
								<ChevronsUpIcon class="size-3.5 animate-bounce text-foreground" />
							</div>
						</div>
					{/if}

					<div
						class="flex flex-1 flex-col items-center gap-3 overflow-y-auto py-3 scrollbar-none"
						bind:this={sidebarEl}
						onscroll={checkSidebarScroll}
					>
						{#each companies as company}
							{@const hasEnabled = hasEnabledModels(company)}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="flex size-11 shrink-0 items-center justify-center rounded-xl transition-all
												{activeCompany.id === company.id
													? 'bg-primary/10 ring-2 ring-primary/40 scale-105'
													: hasEnabled
														? 'hover:bg-muted'
														: 'opacity-35 cursor-default'}"
											onclick={() => { activeCompany = company; search = ''; }}
										>
											<img
												src={iconUrl(company.icon)}
												alt={company.name}
												class="size-6 {hasEnabled ? '' : 'grayscale'}"
											/>
										</button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="right">
									{company.name}{hasEnabled ? '' : ' (Pro)'}
								</Tooltip.Content>
							</Tooltip.Root>
						{/each}
					</div>

					{#if canScrollDown}
						<div class="absolute inset-x-0 bottom-0 z-10 flex justify-center py-1">
							<div class="flex size-6 items-center justify-center rounded-full bg-accent shadow-md">
								<ChevronsDownIcon class="size-3.5 animate-bounce text-foreground" />
							</div>
						</div>
					{/if}
				</div>

				<!-- Model grid -->
				<div class="flex-1 overflow-y-auto p-4">
					{#if search && allFilteredCompanies()}
						{#each allFilteredCompanies()! as company}
							<div class="mb-5">
								<div class="mb-3 flex items-center gap-2 px-1">
									<img src={iconUrl(company.icon)} alt="" class="size-5 {hasEnabledModels(company) ? '' : 'grayscale opacity-50'}" />
									<span class="text-sm font-semibold text-muted-foreground">{company.name}</span>
									{#if !hasEnabledModels(company)}
										<LockIcon class="size-3 text-muted-foreground" />
									{/if}
								</div>
								<div class="grid grid-cols-2 gap-2.5">
									{#each company.models as model}
										{@const disabled = !model.enabled}
										<button
											class="flex items-start gap-3 rounded-xl border border-transparent p-3 text-left transition-colors
												{disabled ? 'opacity-40 cursor-default' : 'hover:bg-muted'}
												{selected.modelId === model.id && selected.companyId === company.id ? 'bg-muted border-primary/20' : ''}"
											onclick={() => selectModel(company, model)}
										>
											<img src={iconUrl(model.icon)} alt="" class="mt-0.5 size-7 shrink-0 {disabled ? 'grayscale' : ''}" />
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-1.5">
													<span class="text-sm font-semibold">{model.name}</span>
													{#if model.free && model.enabled}
														<Badge class="h-4 border-0 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-600">Free</Badge>
													{/if}
													{#if !model.enabled}
														<LockIcon class="size-3 text-muted-foreground" />
													{/if}
													{#if model.isNew && model.enabled}
														<Badge class="h-4 border-0 bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-600">New</Badge>
													{/if}
												</div>
												{@render capabilityBadges(model)}
											</div>
										</button>
									{/each}
								</div>
							</div>
						{/each}
						{#if allFilteredCompanies()!.length === 0}
							<div class="flex h-40 items-center justify-center">
								<p class="text-base text-muted-foreground">No models found</p>
							</div>
						{/if}
					{:else}
						{@const hasEnabled = hasEnabledModels(activeCompany)}
						<div class="mb-4 flex items-center gap-2.5 px-1">
							<img src={iconUrl(activeCompany.icon)} alt="" class="size-7 {hasEnabled ? '' : 'grayscale opacity-50'}" />
							<span class="text-base font-semibold">{activeCompany.name}</span>
							{#if !hasEnabled}
								<Badge class="h-5 border-0 bg-muted px-2 text-[10px] font-semibold text-muted-foreground">Pro</Badge>
							{/if}
						</div>

						{#if !hasEnabled}
							<div class="mb-4 rounded-lg bg-muted/40 px-3 py-2.5">
								<p class="text-sm text-muted-foreground">
									{activeCompany.name} models require a Pro subscription.
								</p>
							</div>
						{/if}

						<div class="grid grid-cols-2 gap-2.5">
							{#each filteredModels() as model}
								{@const disabled = !model.enabled}
								<button
									class="flex items-start gap-3 rounded-xl border border-transparent p-3.5 text-left transition-colors
										{disabled ? 'opacity-40 cursor-default' : 'hover:bg-muted'}
										{selected.modelId === model.id && selected.companyId === activeCompany.id ? 'bg-muted border-primary/20' : ''}"
									onclick={() => selectModel(activeCompany, model)}
								>
									<img src={iconUrl(model.icon)} alt="" class="mt-0.5 size-8 shrink-0 {disabled ? 'grayscale' : ''}" />
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5">
											<span class="text-sm font-semibold">{model.name}</span>
											{#if model.free && model.enabled}
												<Badge class="h-4 border-0 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-600">Free</Badge>
											{/if}
											{#if !model.enabled}
												<LockIcon class="size-3 text-muted-foreground" />
											{/if}
											{#if model.isNew && model.enabled}
												<Badge class="h-5 border-0 bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-600">New</Badge>
											{/if}
										</div>
										{@render capabilityBadges(model)}
									</div>
								</button>
							{/each}
						</div>
						{#if filteredModels().length === 0}
							<div class="flex h-40 items-center justify-center">
								<p class="text-base text-muted-foreground">No models found</p>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
</div>

<style>
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
</style>
