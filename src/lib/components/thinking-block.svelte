<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { slide } from 'svelte/transition';

	let {
		reasoning,
		isThinking,
	}: {
		reasoning: string;
		isThinking: boolean;
	} = $props();

	let expanded = $state(false);
	let elapsed = $state(0);

	// Track elapsed time while thinking — use local var to avoid closure bugs
	let interval: ReturnType<typeof setInterval> | undefined;
	$effect(() => {
		if (isThinking) {
			const start = Date.now();
			elapsed = 0;
			interval = setInterval(() => {
				elapsed = Math.floor((Date.now() - start) / 1000);
			}, 1000);
		} else if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	});

	const label = $derived(
		isThinking
			? `Thinking${elapsed > 0 ? ` (${elapsed}s)` : '...'}`
			: `Thought for ${elapsed}s`
	);
</script>

<div class="mb-3">
	<!-- Progress bar -->
	{#if isThinking}
		<div class="mb-2 h-0.5 w-full overflow-hidden rounded-full bg-muted">
			<div class="thinking-bar h-full rounded-full bg-primary/40"></div>
		</div>
	{/if}

	<!-- Collapsible disclosure -->
	<button
		class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
		onclick={() => expanded = !expanded}
	>
		<ChevronRightIcon
			class="size-3.5 transition-transform {expanded ? 'rotate-90' : ''}"
		/>
		<span>{label}</span>
	</button>

	{#if expanded}
		<div transition:slide={{ duration: 200 }} class="mt-2 border-l-2 border-muted pl-3">
			<p class="whitespace-pre-wrap text-xs text-muted-foreground">{reasoning}</p>
		</div>
	{/if}
</div>

<style>
	.thinking-bar {
		width: 30%;
		animation: sweep 1.5s ease-in-out infinite;
	}
	@keyframes sweep {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(433%); }
	}
</style>
