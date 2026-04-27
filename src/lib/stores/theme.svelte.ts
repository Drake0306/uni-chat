// Shared theme store. Single source of truth for `light | dark | auto`.
//
// Side-effect on import: reads the persisted choice and applies the .dark
// class to <html> immediately, so the first paint after a refresh matches
// the user's preference. Importing this module from +layout.svelte ensures
// it runs before any route component mounts.

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'unichat_theme';

function readStored(): Theme {
	if (typeof window === 'undefined') return 'auto';
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		if (v === 'light' || v === 'dark' || v === 'auto') return v;
	} catch {
		// privacy-mode / quota — fall through
	}
	return 'auto';
}

function applyToDocument(t: Theme) {
	if (typeof window === 'undefined') return;
	if (t === 'dark') {
		document.documentElement.classList.add('dark');
	} else if (t === 'light') {
		document.documentElement.classList.remove('dark');
	} else {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		document.documentElement.classList.toggle('dark', prefersDark);
	}
}

let theme = $state<Theme>(readStored());

if (typeof window !== 'undefined') {
	applyToDocument(theme);
	// Re-evaluate when system preference flips and we're in auto mode.
	window
		.matchMedia('(prefers-color-scheme: dark)')
		.addEventListener('change', () => {
			if (theme === 'auto') applyToDocument('auto');
		});
}

export const themeStore = {
	get value() {
		return theme;
	},
	set(t: Theme) {
		theme = t;
		applyToDocument(t);
		try {
			localStorage.setItem(STORAGE_KEY, t);
		} catch {
			// ignore
		}
	},
};
