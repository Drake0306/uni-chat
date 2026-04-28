<script lang="ts">
	import { iconUrl } from '$lib/config/models.js';

	let {
		name,
		class: className = '',
		alt = '',
	}: { name: string; class?: string; alt?: string } = $props();

	// Lobehub naming convention drives the rendering choice:
	//   foo-color.svg → multi-color branded icon, render as <img> (e.g.
	//                   gemini-color, claude-color, meta-color).
	//   foo.svg       → monochrome icon authored with fill="currentColor"
	//                   (e.g. openai, grok, anthropic, openrouter, groq,
	//                   moonshot). Rendering these via <img> loses currentColor
	//                   because the browser treats the SVG as a standalone
	//                   document and resolves currentColor to black. Instead,
	//                   we render a masked <span> filled with the page's
	//                   currentColor, so the icon inherits text color and
	//                   adapts automatically to light/dark themes (and hover).
	const isMono = $derived(!name.endsWith('-color'));
	const url = $derived(iconUrl(name));

	// We need a non-inline display on the <span> so size-N width/height takes
	// effect — but if the caller already passes `hidden` (typical on mobile
	// breakpoints with `hidden sm:block`), forcing `inline-block` here would
	// override it because Tailwind's CSS lists `.inline-block` after `.hidden`,
	// making the icon stay visible on mobile. Detect that case and let the
	// caller's classes drive display on their own.
	const display = $derived(
		className.split(/\s+/).includes('hidden') ? '' : 'inline-block'
	);
</script>

{#if isMono}
	<span
		class="{display} {className}"
		style="mask:url({url}) center/contain no-repeat;-webkit-mask:url({url}) center/contain no-repeat;background-color:currentColor"
		aria-label={alt || undefined}
		role={alt ? 'img' : undefined}
	></span>
{:else}
	<img src={url} {alt} class={className} />
{/if}
