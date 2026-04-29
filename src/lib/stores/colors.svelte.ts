// Light-mode "use default colors" toggle. Mirrors the theme store pattern:
// reads localStorage and applies the .use-default-colors class to <html>
// synchronously on import so the first paint after a refresh matches the
// user's preference (no FOUC).
//
// Persists to localStorage always; persists to Supabase profiles.use_default_colors
// when the user is authenticated, so the choice follows them across devices.
// The auth store calls syncFromDb() after fetching the profile.
//
// Affects light mode only — when <html> has .dark, the override block in
// app.css is gated behind :not(.dark) and the toggle has no visual effect.

import { supabase } from '$lib/supabase.js';

const STORAGE_KEY = 'unichat_use_default_colors';

function readStored(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function applyToDocument(useDefault: boolean) {
	if (typeof window === 'undefined') return;
	document.documentElement.classList.toggle('use-default-colors', useDefault);
}

let useDefault = $state<boolean>(readStored());

if (typeof window !== 'undefined') {
	applyToDocument(useDefault);
}

function persistLocal(value: boolean) {
	try {
		localStorage.setItem(STORAGE_KEY, String(value));
	} catch {
		// privacy mode / quota — ignore
	}
}

export const colorsStore = {
	get useDefaultColors() {
		return useDefault;
	},
	// Called by the auth store once the profile row arrives. DB is the source
	// of truth across devices; if it disagrees with the local cache, adopt
	// the DB value and update the cache + class.
	syncFromDb(value: boolean) {
		if (useDefault === value) return;
		useDefault = value;
		applyToDocument(value);
		persistLocal(value);
	},
	// User-initiated change. Optimistic — flip locally first, then persist
	// to DB in the background. We don't revert on DB error: better to keep
	// the local choice than overwrite the user's click on a network blip.
	async set(value: boolean, userId: string | null) {
		if (useDefault === value) return;
		useDefault = value;
		applyToDocument(value);
		persistLocal(value);
		if (userId) {
			const { error } = await supabase
				.from('profiles')
				.update({ use_default_colors: value })
				.eq('id', userId);
			if (error) console.error('[colors] persist failed:', error.message);
		}
	},
};
