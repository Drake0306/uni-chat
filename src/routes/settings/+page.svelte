<script lang="ts">
	import { page } from '$app/state';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import SettingsModelsTab from '$lib/components/settings-models-tab.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { colorsStore } from '$lib/stores/colors.svelte.js';
	import { codeBlockSettings } from '$lib/stores/code-block-settings.svelte.js';
	import {
		customizationStore,
		getTierCaps,
		MAX_NAME_LEN,
		MAX_OCCUPATION_LEN,
	} from '$lib/stores/customization.svelte.js';

	// ── Active tab — read from URL query (?tab=...) ─────────
	type TabId =
		| 'account'
		| 'customization'
		| 'history'
		| 'models'
		| 'api-keys'
		| 'attachments'
		| 'shortcuts'
		| 'contact';

	const activeTab = $derived.by<TabId>(() => {
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
		const fromQuery = page.url.searchParams.get('tab') as TabId | null;
		return fromQuery && valid.includes(fromQuery) ? fromQuery : 'account';
	});

	// ── Visual-only state for the Account tab ───────────────
	let emailReceipts = $state(false);

	// ── Customization draft state ───────────────────────────
	// Hydrated from customizationStore via the $effect below. Save Preferences
	// writes the draft back to the store, which persists to localStorage and
	// (when authenticated) Supabase.
	let custName = $state('');
	let custOccupation = $state('');
	let traits = $state<string[]>([]);
	let traitInput = $state('');
	let aboutYou = $state('');
	let hidePersonalInfo = $state(false);
	let statsForNerds = $state(false);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveResetTimer: ReturnType<typeof setTimeout> | null = null;

	const suggestedTraits = [
		'friendly',
		'witty',
		'concise',
		'curious',
		'empathetic',
		'creative',
		'patient',
	];

	// Hydrate the draft from the store. Re-runs whenever the store mutates
	// (initial mount and again when the auth profile fetch resolves on a
	// fresh load). Untracked write to saveStatus to clear stale "saved" /
	// "error" badges if external state changes.
	$effect(() => {
		const v = customizationStore.value;
		custName = v.name;
		custOccupation = v.occupation;
		traits = [...v.traits];
		aboutYou = v.about;
		hidePersonalInfo = v.hidePersonalInfo;
		statsForNerds = v.statsForNerds;
	});

	const isDirty = $derived(
		custName !== customizationStore.name ||
			custOccupation !== customizationStore.occupation ||
			aboutYou !== customizationStore.about ||
			hidePersonalInfo !== customizationStore.hidePersonalInfo ||
			statsForNerds !== customizationStore.statsForNerds ||
			traits.length !== customizationStore.traits.length ||
			traits.some((t, i) => t !== customizationStore.traits[i])
	);

	// Tier-aware caps. authStore.tier is one of 'guest'|'free'|'pro'|'max';
	// the settings page is auth-gated so 'guest' never lands here, but
	// getTierCaps falls back to 'free' caps if anything unexpected slips in.
	const tierCaps = $derived(getTierCaps(authStore.tier));
	const traitsAtCap = $derived(traits.length >= tierCaps.traits);
	const aboutAtCap = $derived(aboutYou.length >= tierCaps.about);
	const showUpgradeHint = $derived(authStore.tier !== 'max');

	function addTrait(value: string) {
		const v = value.trim();
		if (!v) return;
		if (traits.includes(v)) {
			traitInput = '';
			return;
		}
		if (traits.length >= tierCaps.traits) return;
		traits = [...traits, v.slice(0, 50)];
		traitInput = '';
	}

	function removeTrait(value: string) {
		traits = traits.filter((t) => t !== value);
	}

	function onTraitKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === 'Tab') {
			if (traitInput.trim().length === 0) return;
			e.preventDefault();
			addTrait(traitInput);
		} else if (e.key === 'Backspace' && traitInput.length === 0 && traits.length > 0) {
			// Quick affordance: backspace on empty input pops the last trait.
			traits = traits.slice(0, -1);
		}
	}

	async function savePreferences() {
		if (saveResetTimer) {
			clearTimeout(saveResetTimer);
			saveResetTimer = null;
		}
		saveStatus = 'saving';
		const ok = await customizationStore.save(
			{
				name: custName,
				occupation: custOccupation,
				traits,
				about: aboutYou,
				hidePersonalInfo,
				statsForNerds,
			},
			authStore.user?.id ?? null
		);
		saveStatus = ok ? 'saved' : 'error';
		if (ok) {
			saveResetTimer = setTimeout(() => {
				if (saveStatus === 'saved') saveStatus = 'idle';
			}, 2000);
		}
	}

	// ── Tier flags for plan card "Current / Upgrade" buttons ─
	const isFree = $derived(authStore.tier === 'free');
	const isPro = $derived(authStore.tier === 'pro');
	const isMax = $derived(authStore.tier === 'max');
</script>

<svelte:head>
	<title>Settings · Uni Chat</title>
</svelte:head>

{#if activeTab === 'account'}
	<div class="space-y-12">
		<!-- Choose Your Plan -->
		<section>
			<div class="mb-6 flex items-start justify-between gap-4">
				<h2 class="text-2xl font-bold">Choose Your Plan</h2>
				<Button variant="outline" size="sm">Manage Billing &amp; Invoices</Button>
			</div>

			<div class="grid gap-5 md:grid-cols-3">
				<!-- Free -->
				<div class="relative flex flex-col rounded-xl border bg-card p-6">
					<h3 class="text-2xl font-bold">Free</h3>
					<ul class="mt-5 space-y-3">
						<li class="flex items-start gap-2.5">
							<GaugeIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Small monthly limits for basic usage</span>
						</li>
						<li class="flex items-start gap-2.5">
							<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Basic models only</span>
						</li>
					</ul>
					<div class="flex-1"></div>
					<Button variant="outline" class="mt-6 w-full" disabled={isFree}>
						{isFree ? 'Current Plan' : 'Downgrade'}
					</Button>
				</div>

				<!-- Pro (Most Popular) -->
				<div class="relative flex flex-col rounded-xl border-2 border-primary bg-card p-6">
					<div
						class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground"
					>
						Most Popular
					</div>
					<h3 class="text-2xl font-bold">Pro</h3>
					<ul class="mt-5 space-y-3">
						<li class="flex items-start gap-2.5">
							<GaugeIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Expanded monthly limits for more flexibility</span>
						</li>
						<li class="flex items-start gap-2.5">
							<SparklesIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Access to all models</span>
						</li>
						<li class="flex items-start gap-2.5">
							<WrenchIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">File uploads and web search</span>
						</li>
						<li class="flex items-start gap-2.5">
							<ImageIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Image generation</span>
						</li>
					</ul>
					<div class="flex-1"></div>
					<p class="mt-6 text-sm text-muted-foreground">Price shown at checkout.</p>
					<Button class="mt-3 w-full" disabled={isPro}>
						{isPro ? 'Current Plan' : 'Upgrade'}
					</Button>
				</div>

				<!-- Max -->
				<div class="relative flex flex-col rounded-xl border bg-card p-6">
					<h3 class="text-2xl font-bold">Max</h3>
					<ul class="mt-5 space-y-3">
						<li class="flex items-start gap-2.5">
							<GaugeIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Highest tier limits, built for power users</span>
						</li>
						<li class="flex items-start gap-2.5">
							<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Includes everything in Pro</span>
						</li>
						<li class="flex items-start gap-2.5">
							<LayersIcon class="mt-0.5 size-4 shrink-0 text-primary" />
							<span class="text-sm">Concurrent image generations in canvas</span>
						</li>
					</ul>
					<div class="flex-1"></div>
					<p class="mt-6 text-sm text-muted-foreground">Price shown at checkout.</p>
					<Button class="mt-3 w-full" disabled={isMax}>
						{isMax ? 'Current Plan' : 'Upgrade'}
					</Button>
				</div>
			</div>
		</section>

		<!-- Billing Preferences -->
		<section>
			<h2 class="mb-4 text-2xl font-bold">Billing Preferences</h2>
			<div class="flex items-start justify-between gap-6">
				<div class="min-w-0">
					<p class="font-semibold">Email me receipts</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Send receipts to your account email when a payment succeeds.
					</p>
				</div>
				<Switch bind:checked={emailReceipts} aria-label="Email me receipts" />
			</div>
		</section>

		<!-- Security Options -->
		<section>
			<h2 class="mb-4 text-2xl font-bold">Security Options</h2>
			<p class="font-semibold">Devices</p>
			<p class="mt-1 mb-4 text-sm text-muted-foreground">
				Manage and sign out from other devices that are currently logged in to your account.
			</p>
			<Button variant="outline">View Devices</Button>
		</section>

		<!-- Danger Zone -->
		<section>
			<h2 class="mb-3 text-2xl font-bold">Danger Zone</h2>
			<p class="mb-4 text-sm text-muted-foreground">
				Permanently delete your account and all associated data.
			</p>
			<Button variant="destructive">Delete Account</Button>
		</section>
	</div>
{:else if activeTab === 'customization'}
	<div class="space-y-12">
		<!-- ── Customize Uni Chat ────────────────────────── -->
		<section>
			<h2 class="mb-6 text-2xl font-bold">Customize Uni Chat</h2>

			<div class="space-y-6">
				<!-- Name -->
				<div class="space-y-2">
					<label for="cust-name" class="text-sm font-semibold">
						What should Uni Chat call you?
					</label>
					<div class="relative">
						<input
							id="cust-name"
							bind:value={custName}
							maxlength={MAX_NAME_LEN}
							placeholder="Enter your name"
							class="w-full rounded-lg border bg-background px-3.5 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{custName.length}/{MAX_NAME_LEN}
						</span>
					</div>
				</div>

				<!-- Occupation -->
				<div class="space-y-2">
					<label for="cust-occ" class="text-sm font-semibold">What do you do?</label>
					<div class="relative">
						<input
							id="cust-occ"
							bind:value={custOccupation}
							maxlength={MAX_OCCUPATION_LEN}
							placeholder="Engineer, student, etc."
							class="w-full rounded-lg border bg-background px-3.5 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{custOccupation.length}/{MAX_OCCUPATION_LEN}
						</span>
					</div>
				</div>

				<!-- Traits -->
				<div class="space-y-2">
					<label for="cust-traits" class="text-sm font-semibold">
						What traits should Uni Chat have?
					</label>
					<div
						class="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring"
					>
						{#each traits as trait (trait)}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground"
							>
								{trait}
								<button
									type="button"
									class="text-muted-foreground transition-colors hover:text-foreground"
									aria-label={`Remove ${trait}`}
									onclick={() => removeTrait(trait)}
								>
									<XIcon class="size-3" />
								</button>
							</span>
						{/each}
						<input
							id="cust-traits"
							bind:value={traitInput}
							onkeydown={onTraitKeydown}
							maxlength="50"
							disabled={traitsAtCap}
							placeholder={traits.length === 0
								? 'Type a trait and press Enter…'
								: traitsAtCap
									? `${tierCaps.traits} trait limit reached`
									: 'Add another…'}
							class="min-w-[8rem] flex-1 bg-transparent px-1.5 py-0.5 text-sm outline-none disabled:cursor-not-allowed"
						/>
					</div>
					<div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<span>{traits.length}/{tierCaps.traits} traits</span>
						{#if traitsAtCap && showUpgradeHint}
							<span class="text-primary">Upgrade for more traits</span>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2 pt-1">
						{#each suggestedTraits as trait (trait)}
							{@const isSelected = traits.includes(trait)}
							<button
								type="button"
								disabled={isSelected || traitsAtCap}
								onclick={() => addTrait(trait)}
								class="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
							>
								{trait}
								<PlusIcon class="size-3" />
							</button>
						{/each}
					</div>
				</div>

				<!-- About you -->
				<div class="space-y-2">
					<label for="cust-about" class="text-sm font-semibold">
						Anything else Uni Chat should know about you?
					</label>
					<div class="relative">
						<Textarea
							id="cust-about"
							bind:value={aboutYou}
							maxlength={tierCaps.about}
							placeholder="Interests, values, or preferences to keep in mind"
							class="min-h-32 resize-y pr-16"
						/>
						<span class="pointer-events-none absolute bottom-2.5 right-3 text-xs text-muted-foreground">
							{aboutYou.length}/{tierCaps.about}
						</span>
					</div>
					{#if aboutAtCap && showUpgradeHint}
						<p class="text-xs text-primary">Upgrade for a longer About field</p>
					{/if}
				</div>

				<!-- Form-save toggles. Grouped with the form fields above so the
				     "Save Preferences" button covers them in a single batch. -->
				<div class="divide-y border-t pt-2">
					<div class="flex items-start justify-between gap-6 py-5">
						<div class="min-w-0">
							<p class="font-semibold">Hide Personal Information</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Hides your name and email from the UI.
							</p>
						</div>
						<Switch
							bind:checked={hidePersonalInfo}
							aria-label="Hide personal information"
						/>
					</div>
					<div class="flex items-start justify-between gap-6 py-5">
						<div class="min-w-0">
							<p class="font-semibold">Stats for Nerds</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Enables more insights into message stats including tokens per second,
								time to first token, and estimated tokens in the message.
							</p>
						</div>
						<Switch bind:checked={statsForNerds} aria-label="Stats for nerds" />
					</div>
				</div>

				<!-- Save bar — covers all form fields above (name, occupation,
				     traits, about, hide personal info, stats for nerds). The
				     auto-save sections below have their own immediate persistence
				     and aren't affected by this button. -->
				<div class="flex items-center justify-end gap-3 pt-2">
					{#if saveStatus === 'saved'}
						<span class="text-sm text-muted-foreground">Saved</span>
					{:else if saveStatus === 'error'}
						<span class="text-sm text-destructive">Couldn't save — try again</span>
					{/if}
					<Button
						disabled={!isDirty || saveStatus === 'saving'}
						onclick={savePreferences}
					>
						{saveStatus === 'saving' ? 'Saving…' : 'Save Preferences'}
					</Button>
				</div>
			</div>
		</section>

		<!-- ── Visual Options (auto-save) ─────────────────── -->
		<section>
			<h2 class="mb-2 text-2xl font-bold">Visual Options</h2>
			<div class="divide-y">
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Default Colors</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Revert to the standard theme — turn off the cream background and
							yellow accent across both light and dark modes. Synced to your
							account so the choice follows you across devices.
						</p>
					</div>
					<Switch
						checked={colorsStore.useDefaultColors}
						onCheckedChange={(v) => colorsStore.set(v, authStore.user?.id ?? null)}
						aria-label="Use default colors"
					/>
				</div>
			</div>
		</section>

		<!-- ── Code Blocks (auto-save) ────────────────────── -->
		<section>
			<h2 class="mb-2 text-2xl font-bold">Code Blocks</h2>
			<div class="divide-y">
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Auto-collapse long code blocks</p>
						<p class="mt-1 text-sm text-muted-foreground">
							When on, code blocks longer than the line limit below collapse on
							load. Streaming responses always stay expanded so you can watch the
							model write — collapse only kicks in once the message is finished.
							Turn this off to keep every code block expanded by default.
						</p>
					</div>
					<Switch
						checked={codeBlockSettings.autoCollapse}
						onCheckedChange={(v) =>
							codeBlockSettings.setAutoCollapse(v, authStore.user?.id ?? null)}
						aria-label="Auto-collapse long code blocks"
					/>
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Collapse after this many lines</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Code blocks with more lines than this collapse on load. Has no
							effect when auto-collapse is off. Default is 10.
						</p>
					</div>
					<input
						type="number"
						min="1"
						max="1000"
						step="1"
						value={codeBlockSettings.collapseLines}
						disabled={!codeBlockSettings.autoCollapse}
						oninput={(e) => {
							const n = parseInt((e.target as HTMLInputElement).value, 10);
							if (Number.isFinite(n)) {
								codeBlockSettings.setCollapseLines(n, authStore.user?.id ?? null);
							}
						}}
						class="h-10 w-24 shrink-0 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						aria-label="Collapse after this many lines"
					/>
				</div>
			</div>
		</section>
	</div>
{:else if activeTab === 'models'}
	<SettingsModelsTab />
{:else if activeTab === 'contact'}
	<div class="space-y-8">
		<h2 class="text-2xl font-bold">We're here to help!</h2>

		<div class="space-y-4">
			<!-- Privacy Policy -->
			<a
				href="/privacy-policy"
				class="flex items-start gap-4 rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/10"
			>
				<ShieldIcon class="mt-0.5 size-5 shrink-0 text-primary" />
				<div class="min-w-0">
					<p class="font-semibold">Privacy Policy</p>
					<p class="mt-0.5 text-sm text-muted-foreground">
						Read our privacy policy and data handling practices
					</p>
				</div>
			</a>

			<!-- Terms of Service -->
			<a
				href="/terms-of-service"
				class="flex items-start gap-4 rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/10"
			>
				<ScrollTextIcon class="mt-0.5 size-5 shrink-0 text-primary" />
				<div class="min-w-0">
					<p class="font-semibold">Terms of Service</p>
					<p class="mt-0.5 text-sm text-muted-foreground">
						Review our terms of service and usage guidelines
					</p>
				</div>
			</a>
		</div>
	</div>
{:else}
	<!-- Other tabs intentionally empty; content specs are pending. -->
	<div class="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
		Nothing here yet.
	</div>
{/if}
