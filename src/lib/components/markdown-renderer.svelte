<script lang="ts">
	import { renderMarkdown } from '$lib/markdown.js';
	import { codeBlockSettings } from '$lib/stores/code-block-settings.svelte.js';

	let {
		content,
		streaming = false,
	}: { content: string; streaming?: boolean } = $props();

	let html = $state('');
	let containerEl: HTMLDivElement | undefined = $state();

	// Throttle, not debounce. The previous debounce reset on every chunk —
	// fast-streaming providers (Groq GPT-OSS, OpenRouter Llama) never had a
	// long-enough idle gap, so markdown rendered only at end-of-stream and
	// users saw raw `*foo*` / unrendered code fences mid-flight. With
	// throttling the markdown re-renders every ~100ms during streaming
	// regardless of chunk cadence.
	const RENDER_INTERVAL = 100;
	let renderScheduled = false;
	let lastRenderTime = 0;
	let activeRenderId = 0;

	$effect(() => {
		void content; // track the prop as a dependency
		// Track the streaming flag and code-block settings so the markdown
		// re-renders with the right collapse decisions when any of them flip
		// (e.g., streaming → done, or the user changes the threshold).
		void streaming;
		void codeBlockSettings.autoCollapse;
		void codeBlockSettings.collapseLines;
		if (!content) {
			html = '';
			lastRenderTime = 0;
			return;
		}
		if (renderScheduled) return;
		renderScheduled = true;
		const elapsed = Date.now() - lastRenderTime;
		const delay = lastRenderTime === 0 ? 0 : Math.max(0, RENDER_INTERVAL - elapsed);
		setTimeout(async () => {
			renderScheduled = false;
			lastRenderTime = Date.now();
			// Tag this render so out-of-order async completions don't
			// overwrite newer ones if a later render finishes first.
			const myId = ++activeRenderId;
			try {
				const result = await renderMarkdown(content, {
					autoCollapse: codeBlockSettings.autoCollapse,
					collapseLines: codeBlockSettings.collapseLines,
					streaming,
				});
				if (myId === activeRenderId) html = result;
			} catch (err) {
				console.warn('[markdown] render failed:', err);
			}
		}, delay);
	});

	// Event delegation for copy + collapse buttons
	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const btn = target.closest('button');
		if (!btn) return;

		// Code block copy
		if (btn.hasAttribute('data-copy')) {
			const raw = btn.dataset.code ?? '';
			const decoded = raw
				.replace(/&quot;/g, '"')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>');
			navigator.clipboard.writeText(decoded);
			btn.textContent = 'Copied!';
			setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
		}

		// Code block collapse/expand
		if (btn.hasAttribute('data-toggle')) {
			const wrap = btn.closest('.md-code-wrap');
			if (!wrap) return;
			const isCollapsed = wrap.classList.toggle('md-collapsed');
			btn.innerHTML = isCollapsed ? '&#9654; Expand' : '&#9660; Collapse';
		}

		// Table copy
		if (btn.hasAttribute('data-table')) {
			const wrap = btn.closest('.md-table-wrap');
			const table = wrap?.querySelector('table');
			if (table) {
				navigator.clipboard.writeText(table.innerText);
				btn.textContent = 'Copied!';
				setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
			}
		}
	}
</script>

{#if html}
	<div
		role="presentation"
		class="markdown-content prose prose-base prose-neutral dark:prose-invert max-w-none
			prose-headings:font-semibold prose-headings:tracking-tight
			prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
			prose-p:leading-relaxed prose-li:leading-relaxed
			prose-pre:rounded-xl prose-pre:border-0 prose-pre:p-0 prose-pre:bg-transparent
			prose-code:before:content-none prose-code:after:content-none
			prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal
			[&_pre_code]:bg-transparent [&_pre_code]:p-0"
		bind:this={containerEl}
		onclick={handleClick}
	>
		{@html html}
	</div>
{:else if content}
	<p class="whitespace-pre-wrap text-base">{content}</p>
{/if}

<style>
	/* ── Code Block Wrapper ─────────────────────────────── */
	:global(.md-code-wrap) {
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		overflow: hidden;
		margin: 1rem 0;
	}

	:global(.md-code-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	:global(.md-code-lang) {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: lowercase;
	}

	:global(.md-code-actions) {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* (The streaming "Generating" pill is rendered as a Svelte element in
	 * chat-view.svelte — outside the {@html} block — so the spinner element
	 * doesn't get re-created on every throttled markdown re-render. The
	 * .streaming-active class is still set here so future per-block hooks
	 * are easy to add, but no per-code-block loader CSS is wired up.) */

	/* Shiki theme switching — Shiki emits both `--shiki-light` and
	 * `--shiki-dark` CSS variables on every <pre> and <span>. With
	 * defaultColor:false there's no inline `color` declaration, so picking
	 * the right variable is purely a CSS concern. Our app uses .dark on
	 * <html>, not prefers-color-scheme, so the swap rides off that class. */
	:global(.shiki),
	:global(.shiki span) {
		color: var(--shiki-light);
		background-color: var(--shiki-light-bg);
	}
	:global(html.dark .shiki),
	:global(html.dark .shiki span) {
		color: var(--shiki-dark);
		background-color: var(--shiki-dark-bg);
	}
	/* Inner spans share their parent's background — only the <pre> needs the
	 * surface color. Without this every word fragment paints its own bg. */
	:global(.shiki span) {
		background-color: transparent;
	}
	:global(html.dark .shiki span) {
		background-color: transparent;
	}

	:global(.md-code-toggle),
	:global(.md-code-copy) {
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.25rem 0.625rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		color: var(--muted-foreground);
		background: transparent;
		transition: all 0.15s ease;
	}

	:global(.md-code-toggle:hover),
	:global(.md-code-copy:hover) {
		background: var(--accent);
		color: var(--foreground);
		transform: scale(1.05);
	}

	:global(.md-code-toggle:active),
	:global(.md-code-copy:active) {
		transform: scale(0.97);
	}

	:global(.md-code-body) {
		overflow: hidden;
		transition: max-height 0.25s ease, opacity 0.2s ease;
		/* Effectively no cap — the previous 2000px was clipping long scripts
		 * (the body was hidden mid-file even though the raw code was intact,
		 * so Copy worked while the visible block looked truncated). 1,000,000px
		 * is large enough that no realistic code block hits it; the value only
		 * exists so the max-height transition has an explicit target to
		 * animate to/from on collapse. */
		max-height: 1000000px;
		opacity: 1;
	}

	:global(.md-collapsed .md-code-body) {
		max-height: 0;
		opacity: 0;
	}

	:global(.md-code-body .shiki) {
		border-radius: 0 !important;
		padding: 1rem !important;
		font-size: 0.875rem;
		overflow-x: auto;
	}

	/* ── Table Wrapper ──────────────────────────────────── */
	:global(.md-table-wrap) {
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		overflow: hidden;
		margin: 1rem 0;
	}

	:global(.md-table-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	:global(.md-table-label) {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted-foreground);
	}

	:global(.md-table-copy) {
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.25rem 0.625rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		color: var(--muted-foreground);
		background: transparent;
		transition: all 0.15s ease;
	}

	:global(.md-table-copy:hover) {
		background: var(--accent);
		color: var(--foreground);
		transform: scale(1.05);
	}

	:global(.md-table-copy:active) {
		transform: scale(0.97);
	}

	:global(.md-table-body) {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	:global(.md-table-body table) {
		margin: 0 !important;
		border-radius: 0 !important;
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	:global(.md-table-body thead) {
		background: var(--muted);
	}

	:global(.md-table-body th) {
		padding: 0.625rem 1rem;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--border);
		color: var(--foreground);
	}

	:global(.md-table-body td) {
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
		line-height: 1.5;
	}

	:global(.md-table-body tr:last-child td) {
		border-bottom: none;
	}

	:global(.md-table-body tr:hover) {
		background: var(--muted);
		transition: background 0.15s ease;
	}

	/* Prevent awkward mid-word breaks — prefer wrapping at word boundaries */
	:global(.md-table-body td),
	:global(.md-table-body th) {
		word-break: normal;
		overflow-wrap: break-word;
	}

	/* On narrow screens, keep header cells from collapsing */
	@media (max-width: 640px) {
		:global(.md-table-body th),
		:global(.md-table-body td) {
			padding: 0.5rem 0.625rem;
			font-size: 0.8125rem;
		}
	}
</style>
