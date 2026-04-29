<script lang="ts">
	import { untrack, type Component } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import XIcon from '@lucide/svelte/icons/x';

	// ── Step definitions ────────────────────────────────────
	type IconComponent = Component<{ class?: string }>;
	type Demo =
		| {
				// Click target → opens a popover/dialog → escape closes it.
				// Show me opens it and stops; clicking Next closes it before advancing.
				kind: 'open-and-close';
				clickSelector?: string;
				// CSS selector for the popover/dialog that appears AFTER the
				// click. Tour expands the spotlight to include that element so
				// the user sees what opened — instead of staring at the now-
				// invisible little trigger button while the menu is open behind.
				revealSelector?: string;
		  }
		| {
				// Click target → opens; click target again → closes (toggle).
				// Show me opens it and stops; clicking Next toggles it closed.
				kind: 'open-and-toggle';
				clickSelector?: string;
				revealSelector?: string;
		  };

	type Step = {
		id: string;
		title: string;
		body: string;
		icon: IconComponent;
		// CSS selector for the element to spotlight. Omit for a centered
		// card with no spotlight (used for Welcome and the final step).
		target?: string;
		// Optional Show-me demo: lets the user click "Show me" (or the
		// spotlighted control directly) to open the popover/menu the step is
		// describing. The popover stays open until the user clicks Next /
		// Back, at which point the tour closes it before advancing. Steps
		// without a demo just show the spotlight + description.
		demo?: Demo;
	};

	const desktopSteps: Step[] = [
		{
			id: 'welcome',
			icon: SparklesIcon as IconComponent,
			title: 'Welcome to Uni Chat',
			body:
				"A quick tour of the controls — model picker, reasoning, web search, attachments, " +
				'command palette, settings, themes, and your chat history. Skip any time, and check ' +
				'"Don\'t show again" at the end if you don\'t want to see this on next sign-in.',
		},
		{
			id: 'compose',
			icon: MessageSquareIcon as IconComponent,
			target: '[data-onboarding="composer"]',
			title: 'Type & send',
			body:
				'This is where you talk to the AI. Enter sends, Shift+Enter inserts a newline. ' +
				'Empty composer? Tap a suggestion below or pick a category to get started.',
		},
		{
			id: 'models',
			icon: LayersIcon as IconComponent,
			target: '[data-onboarding="model-selector"]',
			title: 'Switch models',
			body:
				"Click to browse free and paid AI models. Each one has different strengths — " +
				'some are faster, some can think harder, some have vision or web search built in. ' +
				'Click "Show me" to open the picker.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="model-selector"] button',
				revealSelector: '[data-slot="popover-content"]',
			},
		},
		{
			id: 'capabilities',
			icon: SlidersHorizontalIcon as IconComponent,
			target: '[data-onboarding="capability-toggles"]',
			title: 'Think, search, attach',
			body:
				'Three toggles in this row: deeper reasoning (slower but smarter), live web search ' +
				'(for current info), and file attachments — drop a PDF or any text / code file ' +
				"and we'll feed its contents to the model. Each toggle tints when on so you " +
				"always know what's active.",
		},
		{
			id: 'search',
			icon: SearchIcon as IconComponent,
			target: '[data-onboarding="search-trigger"]',
			title: 'Quick search & commands',
			body:
				'Press ⌘K from anywhere to open a unified search palette: type to find a past chat, ' +
				'or use it as a command runner — "new chat", "settings", "toggle theme". ' +
				'Click "Show me" to open it.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="search-trigger"] button',
				revealSelector: '[data-slot="dialog-content"]',
			},
		},
		{
			id: 'settings',
			icon: SettingsIcon as IconComponent,
			target: '[data-onboarding="settings-button"]',
			title: 'Quick settings',
			body:
				'The gear in the top-right opens a quick settings popover — theme switcher and a ' +
				'shortcut to your full Settings page. Click "Show me" to open it.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="settings-button"]',
				revealSelector: '[data-slot="popover-content"]',
			},
		},
		{
			id: 'modes',
			icon: PaletteIcon as IconComponent,
			target: '[data-onboarding="settings-button"]',
			title: 'Light, dark, or auto',
			body:
				'Inside settings, the Light / Dark / Auto toggle picks your theme mode. Auto ' +
				'follows your system preference. Click "Show me" to open settings and see them.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="settings-button"]',
				revealSelector: '[data-onboarding="theme-toggles"]',
			},
		},
		{
			id: 'newchat',
			icon: PlusIcon as IconComponent,
			target: '[data-onboarding="new-chat"]',
			title: 'New chats & history',
			body:
				"Start a fresh conversation with the New Chat button. Past chats appear below — " +
				'pinned at the top, then today, then older. Right-click any chat to pin, rename, ' +
				'or delete it.',
		},
		{
			id: 'done',
			icon: CheckIcon as IconComponent,
			title: "You're all set",
			body:
				"That's everything. You can revisit this tour any time by signing out and back " +
				'in (or check "Don\'t show again" below to dismiss it permanently). Have a great chat.',
		},
	];

	const mobileSteps: Step[] = [
		{
			id: 'welcome',
			icon: SparklesIcon as IconComponent,
			title: 'Welcome to Uni Chat',
			body: 'A quick walkthrough of the controls. Skip any time.',
		},
		{
			id: 'compose',
			icon: MessageSquareIcon as IconComponent,
			target: '[data-onboarding="composer"]',
			title: 'Type & send',
			body:
				'Type your message and tap send. Empty composer? Tap a suggestion below to ' +
				'jumpstart the conversation.',
		},
		{
			id: 'models',
			icon: LayersIcon as IconComponent,
			target: '[data-onboarding="model-selector"]',
			title: 'Switch models',
			body:
				'Tap the model name to browse AI models — different ones have different strengths. ' +
				'Tap "Show me" to open the picker.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="model-selector"] button',
				revealSelector: '[data-slot="popover-content"]',
			},
		},
		{
			id: 'tools',
			icon: SlidersHorizontalIcon as IconComponent,
			target: '[data-onboarding="tools-mobile"]',
			title: 'Tools',
			body:
				'Reasoning depth, web search, and file attachments (PDFs or text / code) live behind this Tools button ' +
				'on mobile. Tap "Show me" to open it.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="tools-mobile"]',
				revealSelector: '[data-slot="popover-content"]',
			},
		},
		{
			id: 'sidebar',
			icon: PanelLeftIcon as IconComponent,
			target: '[data-onboarding="floating-toolbar-left"]',
			title: 'Sidebar & new chat',
			body:
				'Top-left: the leftmost button opens the sidebar with your chat history, ' +
				'and the rightmost starts a brand-new conversation. ' +
				'Tap "Show me" to open the sidebar.',
			demo: {
				kind: 'open-and-toggle',
				clickSelector: '[data-onboarding="floating-toolbar-left"] button:first-child',
				revealSelector: '[data-slot="sheet-content"]',
			},
		},
		{
			id: 'search',
			icon: SearchIcon as IconComponent,
			target: '[data-onboarding="floating-toolbar-left"]',
			title: 'Quick search',
			body:
				'The middle button (magnifier) opens a unified search palette: type to find a past ' +
				'chat, or run a command like "new chat" or "settings". Tap "Show me" to open it.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="floating-toolbar-left"] button:nth-child(2)',
				revealSelector: '[data-slot="dialog-content"]',
			},
		},
		{
			id: 'settings',
			icon: SettingsIcon as IconComponent,
			target: '[data-onboarding="settings-button"]',
			title: 'Quick settings',
			body:
				'The gear in the top-right opens a quick settings popover — theme switcher and a ' +
				'shortcut to your full Settings page. Tap "Show me" to open it.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="settings-button"]',
				revealSelector: '[data-slot="popover-content"]',
			},
		},
		{
			id: 'modes',
			icon: PaletteIcon as IconComponent,
			target: '[data-onboarding="settings-button"]',
			title: 'Light, dark, or auto',
			body:
				'Inside settings, the Light / Dark / Auto toggle picks your theme mode. Auto ' +
				'follows your system preference. Tap "Show me" to open settings and see them.',
			demo: {
				kind: 'open-and-close',
				clickSelector: '[data-onboarding="settings-button"]',
				revealSelector: '[data-onboarding="theme-toggles"]',
			},
		},
		{
			id: 'done',
			icon: CheckIcon as IconComponent,
			title: "You're all set",
			body:
				"That's the tour. Check \"Don't show again\" to dismiss for good, or skip it to " +
				'see this again next time you sign in.',
		},
	];

	// ── Reactive viewport detection ─────────────────────────
	// Choose the right step list based on viewport width. Re-evaluates if
	// the user resizes (rare but possible).
	let isMobile = $state(false);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(max-width: 639px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// ── Tour gate ───────────────────────────────────────────
	// Local "closed for this session" flag. Goes true on Skip / X / esc /
	// final-step Got it (whether or not the persistent toggle was on).
	// Persistent dismissal flips authStore.onboardingDismissed via the
	// auth store, which makes the gate fail across reloads too.
	let closed = $state(false);

	const onSettingsOrLogin = $derived(
		page.url.pathname.startsWith('/settings') || page.url.pathname.startsWith('/login')
	);

	const shouldShow = $derived(
		!closed &&
			!authStore.loading &&
			authStore.isAuthenticated &&
			authStore.onboardingDismissed === false &&
			!authStore.pendingSyncDecision &&
			!onSettingsOrLogin
	);

	// ── Step machine ────────────────────────────────────────
	const steps = $derived(isMobile ? mobileSteps : desktopSteps);
	let currentStep = $state(0);
	let dismissForever = $state(false);

	const step = $derived(steps[Math.min(currentStep, steps.length - 1)]);
	const StepIcon = $derived(step.icon);
	const isLast = $derived(currentStep >= steps.length - 1);
	const isFirst = $derived(currentStep === 0);

	// Reset to step 0 each time the gate flips back on (e.g. user signed
	// out and a new user signed in within the same tab).
	let prevShouldShow = false;
	$effect(() => {
		const show = shouldShow;
		untrack(() => {
			if (show && !prevShouldShow) {
				currentStep = 0;
				dismissForever = false;
			}
			prevShouldShow = show;
		});
	});

	// ── Target tracking ─────────────────────────────────────
	// Find the target element's rect, recompute on resize/scroll/mutation.
	let targetRect = $state<DOMRect | null>(null);
	// When a demo opens a popover/dialog/sheet, this points at it. The
	// spotlight + callout track the revealed element so the user can see
	// what's inside, instead of staying anchored to the now-tiny trigger.
	let revealSelector = $state<string | null>(null);
	let revealRect = $state<DOMRect | null>(null);

	const effectiveRect = $derived(revealRect ?? targetRect);

	// Synchronous "Show me has opened a preview" flag. Flipped true the
	// instant Show me (or a passthrough click) fires, BEFORE the popover
	// finishes mounting — so the backdrop drops to pointer-events:none
	// immediately and the user can interact with what just opened. Reset
	// when the preview closes (Close preview / Next / Back / step change).
	let demoActive = $state(false);

	// True while a preview is open. Drives the compact "preview" callout
	// (with Close preview button instead of Next), backdrop pointer-events,
	// and the smaller callout sizing.
	const previewOpen = $derived(demoActive);

	$effect(() => {
		if (!shouldShow) return;
		const sel = step.target;
		if (!sel) {
			targetRect = null;
			return;
		}

		let raf = 0;
		function update() {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const el = document.querySelector(sel!);
				targetRect = el ? el.getBoundingClientRect() : null;
			});
		}
		update();

		const ro = new ResizeObserver(update);
		ro.observe(document.body);
		const mo = new MutationObserver(update);
		mo.observe(document.body, { subtree: true, childList: true, attributes: true });

		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, { passive: true, capture: true });

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			mo.disconnect();
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, { capture: true });
		};
	});

	// Track the revealed popover/dialog/sheet (when present) the same way.
	$effect(() => {
		if (!shouldShow || !revealSelector) {
			revealRect = null;
			return;
		}
		const sel = revealSelector;
		let raf = 0;
		function update() {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const el = document.querySelector(sel);
				revealRect = el ? el.getBoundingClientRect() : null;
			});
		}
		update();

		const ro = new ResizeObserver(update);
		ro.observe(document.body);
		const mo = new MutationObserver(update);
		mo.observe(document.body, { subtree: true, childList: true, attributes: true });

		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, { passive: true, capture: true });

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			mo.disconnect();
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, { capture: true });
		};
	});

	// ── Callout positioning ─────────────────────────────────
	// Position the callout near the highlighted area on both mobile and
	// desktop. Uses the EFFECTIVE rect (revealed popover when a demo is
	// running, otherwise the original target) so it follows what's currently
	// being shown to the user.
	type CalloutPos =
		| { mode: 'centered' }
		| { mode: 'mobile-above'; bottom: number }
		| { mode: 'mobile-below'; top: number }
		| { mode: 'absolute'; top: number; left: number };

	const calloutPos = $derived.by<CalloutPos>(() => {
		if (!step.target || !effectiveRect) return { mode: 'centered' };
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

		if (isMobile) {
			// Special case: a preview that fills the whole viewport (the
			// mobile sidebar sheet, the full-screen search dialog) leaves
			// no room above or below. The default math would put the
			// callout off-screen. Pin it to the top of the screen, on top
			// of the preview, so "Close preview" stays reachable. All
			// other mobile previews (model picker, tools, settings, modes)
			// have room above/below and use the normal placement.
			const compactH = 110;
			if (
				previewOpen &&
				effectiveRect.top < compactH + 14 &&
				vh - effectiveRect.bottom < compactH + 14
			) {
				return { mode: 'mobile-below', top: 12 };
			}
			const targetCenter = effectiveRect.top + effectiveRect.height / 2;
			const gap = 14;
			// Target in lower half → callout sits JUST ABOVE the target
			// (anchored by `bottom`, so we don't need to know callout height).
			// Target in upper half → callout sits JUST BELOW the target.
			if (targetCenter > vh / 2) {
				return { mode: 'mobile-above', bottom: vh - effectiveRect.top + gap };
			}
			return { mode: 'mobile-below', top: effectiveRect.bottom + gap };
		}

		// Desktop placement. While a preview is open the callout shrinks to a
		// compact pill so it fits beside the popover/dialog instead of covering
		// it (the user is supposed to be looking AT the preview).
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
		const calloutW = previewOpen ? 280 : 480;
		const calloutH = previewOpen ? 110 : 240;
		const gap = 16;

		const below = vh - effectiveRect.bottom;
		const above = effectiveRect.top;
		const idealLeft = effectiveRect.left + effectiveRect.width / 2 - calloutW / 2;
		const left = Math.max(gap, Math.min(idealLeft, vw - calloutW - gap));

		if (below >= calloutH + gap) {
			return { mode: 'absolute', top: effectiveRect.bottom + gap, left };
		}
		if (above >= calloutH + gap) {
			return { mode: 'absolute', top: effectiveRect.top - calloutH - gap, left };
		}

		// Above/below don't fit (e.g. a tall popover dominates the viewport).
		// Try beside the spotlight so the callout doesn't overlap the popover.
		const rightSpace = vw - effectiveRect.right - gap;
		const leftSpace = effectiveRect.left - gap;
		const idealTop = effectiveRect.top + effectiveRect.height / 2 - calloutH / 2;
		const top = Math.max(gap, Math.min(idealTop, vh - calloutH - gap));
		if (rightSpace >= calloutW) {
			return { mode: 'absolute', top, left: effectiveRect.right + gap };
		}
		if (leftSpace >= calloutW) {
			return { mode: 'absolute', top, left: effectiveRect.left - calloutW - gap };
		}
		return { mode: 'centered' };
	});

	// ── Spotlight rect (with padding) ───────────────────────
	const spotlightRect = $derived.by(() => {
		if (!effectiveRect) return null;
		const pad = 8;
		return {
			top: effectiveRect.top - pad,
			left: effectiveRect.left - pad,
			width: effectiveRect.width + pad * 2,
			height: effectiveRect.height + pad * 2,
		};
	});

	// ── Actions ────────────────────────────────────────────
	function pickDemoEl(): HTMLElement | null {
		if (!step.demo) return null;
		const sel = step.demo.clickSelector ?? step.target;
		if (!sel) return null;
		const el = document.querySelector(sel);
		return el instanceof HTMLElement ? el : null;
	}

	// If a previous Show-me opened a popover/sheet/dialog and it's still
	// mounted, close it. Called on Next / Back / Skip / finish so the
	// open menu doesn't linger over the next step.
	function closeOpenPopover() {
		const d = step.demo;
		if (!d || !d.revealSelector) return;
		const isOpen = !!document.querySelector(d.revealSelector);
		if (!isOpen) return;
		if (d.kind === 'open-and-close') {
			document.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
			);
		} else if (d.kind === 'open-and-toggle') {
			pickDemoEl()?.click();
		}
	}

	function next() {
		if (isLast) return;
		closeOpenPopover();
		revealSelector = null;
		demoActive = false;
		currentStep += 1;
	}
	// Closes the preview (the popover Show me opened) without advancing.
	// Bound to the "Close preview" button that replaces Next while a preview
	// is on screen, so the user explicitly dismisses the open menu before
	// continuing — avoids the "first click on Next eaten by bits-ui's
	// dismiss-on-outside" feel where Next seemed to need a double-click.
	function closePreview() {
		closeOpenPopover();
		revealSelector = null;
		demoActive = false;
	}
	function back() {
		if (isFirst) return;
		closeOpenPopover();
		revealSelector = null;
		demoActive = false;
		currentStep -= 1;
	}
	async function finish() {
		closeOpenPopover();
		demoActive = false;
		closed = true;
		if (dismissForever) {
			await authStore.dismissOnboarding();
		}
	}

	// ── Show-me demo ───────────────────────────────────────
	// Show me clicks the target to open the popover/menu/sheet, then expands
	// the spotlight to cover the revealed element. It stops there — the user
	// drives advancing with Next, which closes the popover first.
	function runDemo() {
		const d = step.demo;
		if (!d) return;
		const el = pickDemoEl();
		if (!el) return;

		// If the popover from this step is already open (user clicked the
		// real control or hit Show me twice), don't toggle it shut.
		const alreadyOpen = d.revealSelector
			? !!document.querySelector(d.revealSelector)
			: false;
		// Flip preview state BEFORE the click so the backdrop drops to
		// pointer-events:none synchronously — otherwise the user's first
		// click into the just-opened popover hits the backdrop and bits-ui
		// dismisses the popover before the spotlight finishes catching up.
		demoActive = true;
		if (!alreadyOpen) el.click();

		// After a beat for the popover/dialog to mount + animate in, expand
		// the spotlight to cover that element. Without this the spotlight
		// stays on the now-hidden trigger button while the actual content
		// (which is what the user wants to see) is somewhere else.
		if (d.revealSelector) {
			const sel = d.revealSelector;
			window.setTimeout(() => {
				if (currentStep < steps.length && step.demo?.revealSelector === sel) {
					revealSelector = sel;
				}
			}, 180);
		}
	}

	// If the user clicks the spotlighted element themselves (the spotlight
	// allows pass-through clicks), expand the spotlight to the revealed
	// popover so the tour stays in sync with what's on screen.
	$effect(() => {
		if (!shouldShow) return;
		const d = step.demo;
		if (!d || !d.revealSelector) return;
		const el = pickDemoEl();
		if (!el) return;
		const sel = d.revealSelector;
		const handler = () => {
			demoActive = true;
			window.setTimeout(() => {
				if (document.querySelector(sel)) revealSelector = sel;
			}, 180);
		};
		el.addEventListener('click', handler);
		return () => el.removeEventListener('click', handler);
	});

	// Bits-UI dialogs/popovers/sheets self-dismiss on outside pointerdown via
	// a document-level capture listener. When Show me opens, e.g., the search
	// dialog, clicking the Back/Next/Got it buttons (which sit outside the
	// dialog) would trigger that dismiss BEFORE the click reaches our handler,
	// making the buttons feel unresponsive on the first try. We sit in front
	// of bits-ui by registering our own capture-phase listener as soon as the
	// tour is visible — earlier than any dialog opens — and stop propagation
	// when the pointerdown is on our callout. The button still receives click;
	// we then drive the dismiss ourselves through closeOpenPopover() in next().
	$effect(() => {
		if (!shouldShow) return;
		const swallow = (e: Event) => {
			const target = e.target as Node | null;
			if (!target) return;
			const callout = document.querySelector('.onboarding-callout');
			if (callout?.contains(target)) e.stopImmediatePropagation();
		};
		document.addEventListener('pointerdown', swallow, { capture: true });
		document.addEventListener('mousedown', swallow, { capture: true });
		document.addEventListener('touchstart', swallow, { capture: true });
		return () => {
			document.removeEventListener('pointerdown', swallow, { capture: true });
			document.removeEventListener('mousedown', swallow, { capture: true });
			document.removeEventListener('touchstart', swallow, { capture: true });
		};
	});

	// Keyboard nav only — no Esc bail-out. User goes through the whole flow.
	function handleKeydown(e: KeyboardEvent) {
		if (!shouldShow) return;
		if (e.key === 'ArrowRight' || e.key === 'Enter') {
			if (isLast) {
				e.preventDefault();
				finish();
			} else {
				e.preventDefault();
				next();
			}
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			back();
		}
	}
</script>

<svelte:window onkeydown={shouldShow ? handleKeydown : undefined} />

{#if shouldShow}
	<!-- Backdrop dim. The spotlight (when present) cuts a hole via box-shadow.
	     When NO preview is open, the backdrop catches clicks so the user can't
	     accidentally interact with the dimmed app behind it. While a preview
	     IS open, pointer-events drop to none so the user can actually use the
	     popover/dialog they just revealed (search input, theme toggles, etc.)
	     — the callout itself opts back in via pointer-events: auto. -->
	<div
		class="onboarding-backdrop fixed inset-0 z-100 {previewOpen ? 'pointer-events-none' : ''}"
		role="dialog"
		aria-modal="true"
		aria-label="Onboarding tour"
	>
		<!-- Spotlight + pulse + callout are wrapped in a #key block so step
		     transitions cleanly fade the old elements out and the new in,
		     instead of sliding from one direction. Within a step the same
		     elements stay mounted and reposition smoothly via CSS position
		     transitions (used during demo reveals). -->
		{#key step.id}
			<!-- Spotlight cut-out. box-shadow: 0 0 0 9999px ... darkens
			     everything OUTSIDE this box; everything INSIDE shows the
			     underlying page. -->
			{#if spotlightRect}
				<div
					class="onboarding-spotlight pointer-events-none fixed rounded-2xl"
					style="top: {spotlightRect.top}px; left: {spotlightRect.left}px; width: {spotlightRect.width}px; height: {spotlightRect.height}px;"
					in:fade={{ duration: 220, easing: cubicOut }}
					out:fade={{ duration: 140 }}
				></div>
				<!-- Pulsing accent ring. -->
				<div
					class="onboarding-pulse pointer-events-none fixed rounded-2xl"
					style="top: {spotlightRect.top}px; left: {spotlightRect.left}px; width: {spotlightRect.width}px; height: {spotlightRect.height}px;"
					in:fade={{ duration: 220, easing: cubicOut }}
					out:fade={{ duration: 140 }}
				></div>
			{:else}
				<!-- No target: full screen darken with a centered card on top. -->
				<div
					class="onboarding-full-dim pointer-events-none fixed inset-0"
					in:fade={{ duration: 220, easing: cubicOut }}
					out:fade={{ duration: 140 }}
				></div>
			{/if}

			<!-- Callout card. Sized larger on desktop for richer content;
			     centered cards (welcome/done) are wider still. While a preview
			     is open the callout shrinks to a compact pill so it doesn't
			     cover the popover/dialog the user is trying to look at. -->
			<div
				class="onboarding-callout pointer-events-auto fixed z-110 flex flex-col rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-border
					{previewOpen
						? 'w-[min(280px,calc(100vw-1.5rem))]'
						: calloutPos.mode === 'centered'
							? 'w-[min(560px,calc(100vw-2rem))]'
							: 'w-[min(480px,calc(100vw-2rem))]'}"
				class:onboarding-callout-centered={!previewOpen && calloutPos.mode === 'centered'}
				class:onboarding-callout-mobile-above={calloutPos.mode === 'mobile-above'}
				class:onboarding-callout-mobile-below={calloutPos.mode === 'mobile-below'}
				style={calloutPos.mode === 'absolute'
					? `top: ${calloutPos.top}px; left: ${calloutPos.left}px;`
					: calloutPos.mode === 'mobile-above'
						? `bottom: ${calloutPos.bottom}px;`
						: calloutPos.mode === 'mobile-below'
							? `top: ${calloutPos.top}px;`
							: ''}
				in:fade={{ duration: 250, easing: cubicOut }}
				out:fade={{ duration: 150 }}
			>
			{#if previewOpen}
				<!-- Compact preview pill: just title + Close preview. The user
				     is supposed to be exploring the revealed popover; the
				     callout's job here is to stay out of the way and offer a
				     single, obvious "Close preview" exit. Once dismissed the
				     full callout (with Next) returns. -->
				<div class="flex items-center gap-3 px-4 py-3">
					<span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<StepIcon class="size-4" />
					</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold">{step.title}</p>
						<p class="text-xs text-muted-foreground">Previewing — close to continue</p>
					</div>
				</div>
				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-3 py-2">
					<Button size="sm" onclick={closePreview} class="gap-1.5">
						<XIcon class="size-3.5" />
						Close preview
					</Button>
				</div>
			{:else}
				<!-- Header: step counter only. No X — the user goes through the
				     whole flow. They control persistent dismiss via the "Don't
				     show again" toggle on the final step; otherwise the tour
				     reappears next sign-in. -->
				<div class="px-6 pb-2 pt-5">
					<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Step {currentStep + 1} of {steps.length}
					</span>
				</div>

				<!-- Icon + title + body. Centered cards (welcome/done) get a larger
				     icon and stacked layout for visual weight. -->
				<div class="px-6 pb-5">
					{#if calloutPos.mode === 'centered'}
						<div class="mb-4 flex justify-center">
							<span class="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<StepIcon class="size-7" />
							</span>
						</div>
						<h3 class="text-center text-xl font-semibold">{step.title}</h3>
						<p class="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{step.body}</p>
					{:else}
						<div class="flex items-start gap-3">
							<span
								class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
							>
								<StepIcon class="size-5" />
							</span>
							<div class="min-w-0 flex-1">
								<h3 class="text-base font-semibold">{step.title}</h3>
								<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Final step: "Don't show again" toggle -->
				{#if isLast}
					<label
						class="mx-6 mb-4 flex cursor-pointer select-none items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm transition-colors hover:bg-muted"
					>
						<input
							type="checkbox"
							bind:checked={dismissForever}
							class="size-4 cursor-pointer accent-primary"
						/>
						<span>Don't show this again</span>
					</label>
				{/if}

				<!-- Footer: progress dots + Show me / Back / Next / Got it -->
				<div
					class="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-6 py-3"
				>
					<div class="flex items-center gap-1.5">
						{#each steps as _, i (i)}
							<span
								class="block size-1.5 rounded-full transition-colors {i === currentStep
									? 'bg-foreground'
									: 'bg-muted-foreground/30'}"
							></span>
						{/each}
					</div>
					<div class="flex items-center gap-2">
						{#if !isFirst}
							<Button variant="ghost" size="sm" onclick={back}>Back</Button>
						{/if}
						{#if step.demo && !isLast}
							<Button variant="outline" size="sm" onclick={() => runDemo()} class="gap-1.5">
								<PlayIcon class="size-3.5" />
								Show me
							</Button>
						{/if}
						{#if !isLast}
							<Button size="sm" onclick={next}>Next</Button>
						{:else}
							<Button size="sm" onclick={finish}>Got it</Button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		{/key}
	</div>
{/if}

<style>
	/* Box-shadow trick: the spotlight element is a transparent box; its
	   massive outset shadow paints the rest of the viewport dim. The
	   backdrop element above this one is empty visually — the actual
	   darkening lives in this shadow so the spotlight "cuts" the dim. */
	.onboarding-spotlight {
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
		transition:
			top 0.3s ease-out,
			left 0.3s ease-out,
			width 0.3s ease-out,
			height 0.3s ease-out;
	}

	/* Soft pulsing halo just outside the spotlight to draw the eye to
	   the highlighted control. Two layered shadows give a gentle glow
	   that doesn't fight the spotlight cut. */
	.onboarding-pulse {
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 0.7),
			0 0 0 6px rgba(99, 102, 241, 0.35);
		animation: onboarding-pulse 1.6s ease-in-out infinite;
		transition:
			top 0.3s ease-out,
			left 0.3s ease-out,
			width 0.3s ease-out,
			height 0.3s ease-out;
	}
	@keyframes onboarding-pulse {
		0%,
		100% {
			box-shadow:
				0 0 0 2px rgba(255, 255, 255, 0.7),
				0 0 0 6px rgba(99, 102, 241, 0.35);
		}
		50% {
			box-shadow:
				0 0 0 2px rgba(255, 255, 255, 0.9),
				0 0 0 14px rgba(99, 102, 241, 0);
		}
	}

	/* Used when there's no target — full-viewport dim with the callout
	   centered on top. */
	.onboarding-full-dim {
		background: rgba(0, 0, 0, 0.6);
	}

	/* Centered card position (no target / fallback / final step). */
	.onboarding-callout-centered {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	/* Mobile: position the callout JUST ABOVE or JUST BELOW the spotlighted
	   target (not pinned to the screen edge). The `top` / `bottom` value
	   itself comes from the inline style; these classes only handle
	   horizontal centering and full width. */
	.onboarding-callout-mobile-above,
	.onboarding-callout-mobile-below {
		left: 50%;
		transform: translateX(-50%);
		width: calc(100vw - 1.5rem);
		/* Smooth reposition when the target/reveal rect changes during a demo. */
		transition:
			top 0.3s ease-out,
			bottom 0.3s ease-out;
	}

	/* Position transitions for within-step movement (e.g. when a demo opens
	   a popover and the spotlight expands to cover it — the callout follows).
	   Step-to-step entrance/exit animation is handled by Svelte's fade
	   transition via the {#key} block in the markup, so no @keyframes here. */
	.onboarding-callout {
		transition:
			top 0.3s ease-out,
			left 0.3s ease-out,
			bottom 0.3s ease-out;
	}

	/* Honor user's reduced-motion preference: skip animations. */
	@media (prefers-reduced-motion: reduce) {
		.onboarding-spotlight,
		.onboarding-pulse,
		.onboarding-callout {
			transition: none;
			animation: none;
		}
	}
</style>
