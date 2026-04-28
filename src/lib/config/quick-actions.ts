import PlusIcon from '@lucide/svelte/icons/plus';
import SettingsIcon from '@lucide/svelte/icons/settings';
import SunIcon from '@lucide/svelte/icons/sun';
import LogOutIcon from '@lucide/svelte/icons/log-out';
import { goto } from '$app/navigation';
import { themeStore } from '$lib/stores/theme.svelte.js';
import { authStore } from '$lib/stores/auth.svelte.js';
import { chatStore } from '$lib/stores/chats.svelte.js';
import type { Component } from 'svelte';

// Icon components from @lucide/svelte. We use a permissive shape so any
// lucide icon (or any compatible Svelte component that accepts a `class`
// prop) can be slotted in without type wrangling.
type IconComponent = Component<{ class?: string }>;

export interface QuickAction {
	id: string;
	label: string;
	description: string;
	icon: IconComponent;
	shortcut?: string;
	// Extra search terms so the action surfaces under reasonable synonyms
	// (e.g. "logout" finds Sign out; "preferences" finds Settings).
	synonyms?: string[];
	// Hide the action when the predicate returns false. Re-evaluated on each
	// palette open / query change, so guest-vs-authenticated flips correctly.
	visible?: () => boolean;
	onSelect: () => void | Promise<void>;
}

export const quickActions: QuickAction[] = [
	{
		id: 'new-chat',
		label: 'New chat',
		description: 'Start a fresh conversation',
		icon: PlusIcon as IconComponent,
		synonyms: ['create', 'start', 'compose'],
		onSelect: () => {
			chatStore.clearActive();
			goto('/');
		},
	},
	{
		id: 'settings',
		label: 'Settings',
		description: 'Account, models, API keys, theme',
		icon: SettingsIcon as IconComponent,
		synonyms: ['preferences', 'config', 'account', 'profile'],
		visible: () => authStore.isAuthenticated,
		onSelect: () => {
			goto('/settings');
		},
	},
	{
		id: 'toggle-theme',
		label: 'Toggle theme',
		description: 'Cycle light → dark → auto',
		icon: SunIcon as IconComponent,
		synonyms: ['dark mode', 'light mode', 'appearance', 'color scheme'],
		onSelect: () => {
			const t = themeStore.value;
			themeStore.set(t === 'light' ? 'dark' : t === 'dark' ? 'auto' : 'light');
		},
	},
	{
		id: 'sign-out',
		label: 'Sign out',
		description: 'Log out of your account',
		icon: LogOutIcon as IconComponent,
		synonyms: ['logout', 'log out'],
		visible: () => authStore.isAuthenticated,
		onSelect: async () => {
			await authStore.signOut();
			goto('/', { replaceState: true });
		},
	},
];

export function getVisibleActions(): QuickAction[] {
	return quickActions.filter((a) => !a.visible || a.visible());
}

// Substring-match across label + description + synonyms. Cheap, predictable,
// good enough for ~10 actions. If the registry grows past ~50, swap for a
// fuzzy matcher.
export function filterActions(query: string): QuickAction[] {
	const q = query.toLowerCase().trim();
	const visible = getVisibleActions();
	if (!q) return visible;
	return visible.filter((a) => {
		const haystack = `${a.label} ${a.description} ${(a.synonyms ?? []).join(' ')}`.toLowerCase();
		return haystack.includes(q);
	});
}
