<script lang="ts">
	import { page } from '$app/state';
	import GaugeIcon from '@lucide/svelte/icons/gauge';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import InfoIcon from '@lucide/svelte/icons/info';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import SettingsModelsTab from '$lib/components/settings-models-tab.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';

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

	// ── Visual-only state for the Customization tab ─────────
	let custName = $state('');
	let custOccupation = $state('');
	let traitInput = $state('');
	let aboutYou = $state('');
	const suggestedTraits = [
		'friendly',
		'witty',
		'concise',
		'curious',
		'empathetic',
		'creative',
		'patient',
	];

	let disableExternalLinkWarning = $state(false);
	let invertSendNewLine = $state(false);

	let boringTheme = $state(false);
	let hidePersonalInfo = $state(false);
	let disableThematicBreaks = $state(false);
	let statsForNerds = $state(false);
	let minimalistCommandMenu = $state(false);

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
				<!-- Profile -->
				<div class="space-y-2">
					<div class="flex items-center gap-1.5">
						<p class="text-sm font-semibold">Profile</p>
						<InfoIcon class="size-3.5 text-muted-foreground" />
					</div>
					<div class="flex gap-2">
						<button
							type="button"
							class="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3.5 py-2.5 text-sm transition-colors hover:bg-accent/50"
						>
							<MessageCircleIcon class="size-4 text-muted-foreground" />
							<span>Default</span>
							<ChevronDownIcon class="ml-auto size-4 text-muted-foreground" />
						</button>
						<button
							type="button"
							class="flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							aria-label="Add profile"
						>
							<PlusIcon class="size-4" />
						</button>
					</div>
				</div>

				<!-- Name -->
				<div class="space-y-2">
					<label for="cust-name" class="text-sm font-semibold">
						What should Uni Chat call you?
					</label>
					<div class="relative">
						<input
							id="cust-name"
							bind:value={custName}
							maxlength="50"
							placeholder="Enter your name"
							class="w-full rounded-lg border bg-background px-3.5 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{custName.length}/50
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
							maxlength="100"
							placeholder="Engineer, student, etc."
							class="w-full rounded-lg border bg-background px-3.5 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{custOccupation.length}/100
						</span>
					</div>
				</div>

				<!-- Traits -->
				<div class="space-y-2">
					<label for="cust-traits" class="text-sm font-semibold">
						What traits should Uni Chat have?
					</label>
					<div class="relative">
						<input
							id="cust-traits"
							bind:value={traitInput}
							maxlength="100"
							placeholder="Type a trait and press Enter or Tab..."
							class="w-full rounded-lg border bg-background px-3.5 py-2.5 pr-16 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
						/>
						<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{traitInput.length}/100
						</span>
					</div>
					<div class="flex flex-wrap gap-2 pt-1">
						{#each suggestedTraits as trait (trait)}
							<button
								type="button"
								class="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
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
							maxlength={3000}
							placeholder="Interests, values, or preferences to keep in mind"
							class="min-h-32 resize-y pr-16"
						/>
						<span class="pointer-events-none absolute bottom-2.5 right-3 text-xs text-muted-foreground">
							{aboutYou.length}/3000
						</span>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between pt-2">
					<Button variant="outline">Load Legacy Data</Button>
					<Button disabled>Save Preferences</Button>
				</div>
			</div>
		</section>

		<!-- ── Behavior Options ──────────────────────────── -->
		<section>
			<h2 class="mb-2 text-2xl font-bold">Behavior Options</h2>
			<div class="divide-y">
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Disable External Link Warning</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Skip the confirmation dialog when clicking external links. Note: We cannot
							guarantee the safety of external links, use this option at your own risk.
						</p>
					</div>
					<Switch
						bind:checked={disableExternalLinkWarning}
						aria-label="Disable external link warning"
					/>
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Invert Send/New Line Behavior</p>
						<p class="mt-1 text-sm text-muted-foreground">
							When enabled, use Enter for newlines, and a modifier key + Enter to send
							messages. When disabled, use Enter to send and Shift + Enter for new lines.
						</p>
					</div>
					<Switch
						bind:checked={invertSendNewLine}
						aria-label="Invert send and new line behavior"
					/>
				</div>
			</div>
		</section>

		<!-- ── Visual Options ────────────────────────────── -->
		<section>
			<h2 class="mb-2 text-2xl font-bold">Visual Options</h2>
			<div class="divide-y">
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Boring Theme</p>
						<p class="mt-1 text-sm text-muted-foreground">
							If you think the pink is too much, turn this on to tone it down.
						</p>
					</div>
					<Switch bind:checked={boringTheme} aria-label="Boring theme" />
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Hide Personal Information</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Hides your name and email from the UI.
						</p>
					</div>
					<Switch bind:checked={hidePersonalInfo} aria-label="Hide personal information" />
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Disable Thematic Breaks</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Hides horizontal lines in chat messages. (Some browsers have trouble
							rendering these, turn off if you have bugs with duplicated lines)
						</p>
					</div>
					<Switch
						bind:checked={disableThematicBreaks}
						aria-label="Disable thematic breaks"
					/>
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Stats for Nerds</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Enables more insights into message stats including tokens per second, time
							to first token, and estimated tokens in the message.
						</p>
					</div>
					<Switch bind:checked={statsForNerds} aria-label="Stats for nerds" />
				</div>
				<div class="flex items-start justify-between gap-6 py-5">
					<div class="min-w-0">
						<p class="font-semibold">Minimalist command menu</p>
						<p class="mt-1 text-sm text-muted-foreground">
							When enabled, command menu items are hidden until you start typing.
						</p>
					</div>
					<Switch
						bind:checked={minimalistCommandMenu}
						aria-label="Minimalist command menu"
					/>
				</div>
			</div>

			<!-- Fonts -->
			<div class="mt-8 grid gap-8 md:grid-cols-2">
				<div class="space-y-6">
					<div class="space-y-2">
						<p class="font-semibold">Main Text Font</p>
						<p class="text-sm text-muted-foreground">
							Used in general text throughout the app.
						</p>
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg border bg-background px-3.5 py-2.5 text-sm transition-colors hover:bg-accent/50"
						>
							<span>Inter <span class="text-muted-foreground">(default)</span></span>
							<ChevronDownIcon class="size-4 text-muted-foreground" />
						</button>
					</div>
					<div class="space-y-2">
						<p class="font-semibold">Code Font</p>
						<p class="text-sm text-muted-foreground">
							Used in code blocks and inline code in chat messages.
						</p>
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg border bg-background px-3.5 py-2.5 text-sm transition-colors hover:bg-accent/50"
						>
							<span>JetBrains Mono <span class="text-muted-foreground">(default)</span></span>
							<ChevronDownIcon class="size-4 text-muted-foreground" />
						</button>
					</div>
				</div>

				<!-- Fonts Preview -->
				<div>
					<p class="mb-2 font-semibold">Fonts Preview</p>
					<div class="rounded-xl border bg-card p-4">
						<div class="flex justify-end">
							<div class="max-w-[80%] rounded-2xl bg-accent px-4 py-2 text-sm">
								Can you write me a simple hello world program?
							</div>
						</div>
						<p class="mt-4 text-sm">Sure, here you go:</p>
						<div class="mt-3 overflow-hidden rounded-lg border">
							<div class="border-b bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
								typescript
							</div>
							<pre class="overflow-x-auto bg-background p-3 font-mono text-xs leading-relaxed"><code>function greet(name: string) &lbrace;
  console.log(`Hello, $&lbrace;name&rbrace;!`);
  return true;
&rbrace;</code></pre>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
{:else if activeTab === 'models'}
	<SettingsModelsTab />
{:else}
	<!-- Other tabs intentionally empty; content specs are pending. -->
	<div class="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
		Nothing here yet.
	</div>
{/if}
