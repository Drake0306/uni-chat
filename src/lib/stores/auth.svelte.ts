import { supabase } from '$lib/supabase.js';
import { colorsStore } from './colors.svelte.js';
import { codeBlockSettings } from './code-block-settings.svelte.js';
import type { User, Session } from '@supabase/supabase-js';

let user = $state<User | null>(null);
let session = $state<Session | null>(null);
let loading = $state(true);
let tier = $state<'guest' | 'free' | 'pro' | 'max'>('guest');
let pendingSyncDecision = $state(false);
// Whether this user has dismissed the first-login onboarding tour. null
// means we haven't fetched the profile yet (initial load) or the user is
// a guest. Strict boolean false is the only state that triggers the tour.
let onboardingDismissed = $state<boolean | null>(null);
// Set true when SIGNED_OUT fires unexpectedly (refresh-token failure /
// session revoked / token expired without a working refresh) so the UI
// can prompt the user to sign in again. Distinguished from a user-initiated
// sign-out via the _userInitiatedSignOut flag below.
let sessionExpired = $state(false);
// Tracks whether we've ever observed a valid session in this tab. Lets us
// tell apart "fresh-load with no session" (no prompt) from "had a session,
// then lost it" (prompt).
let _wasAuthenticated = false;
// Set by signOut() before awaiting so the onAuthStateChange SIGNED_OUT
// handler can suppress the expiration prompt when the user clicked Sign out.
let _userInitiatedSignOut = false;

// Single auth listener — handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
// IMPORTANT: This callback is awaited by _notifyAllSubscribers inside _initialize().
// Awaiting any Supabase client call here creates a deadlock:
//   callback awaits client call → client call awaits getSession() →
//   getSession() awaits initializePromise → initializePromise awaits _initialize() →
//   _initialize() awaits this callback → DEADLOCK
// So we must NOT await Supabase client calls here. Use fire-and-forget instead.
supabase.auth.onAuthStateChange((_event, sess) => {
	session = sess;
	user = sess?.user ?? null;
	loading = false;

	if (sess) {
		// Any time we observe a real session, mark this tab as having been
		// authenticated. Used by the SIGNED_OUT branch below to tell apart
		// "session expired" from "fresh-load with no session".
		_wasAuthenticated = true;
	}

	if (user) {
		// Fire-and-forget — does NOT block the callback
		supabase
			.from('profiles')
			.select(
				'tier, onboarding_dismissed, use_default_colors, code_block_auto_collapse, code_block_collapse_lines'
			)
			.eq('id', user.id)
			.single()
			.then(
				({ data }) => {
					tier = (data?.tier as typeof tier) ?? 'free';
					// On error or missing column, fall back to true so we don't
					// surprise the user with an unexpected tour. The tour is opt-in
					// to seeing it, not opt-out.
					onboardingDismissed =
						typeof data?.onboarding_dismissed === 'boolean'
							? data.onboarding_dismissed
							: true;
					// DB is the source of truth across devices for the custom-
					// colors toggle; if it differs from the localStorage cache,
					// the colors store updates the cache + html class.
					if (typeof data?.use_default_colors === 'boolean') {
						colorsStore.syncFromDb(data.use_default_colors);
					}
					// Same idea for code-block accordion settings.
					codeBlockSettings.syncFromDb({
						autoCollapse: data?.code_block_auto_collapse,
						collapseLines: data?.code_block_collapse_lines,
					});
				},
				() => {
					tier = 'free';
					onboardingDismissed = true;
				}
			);
	} else {
		tier = 'guest';
		onboardingDismissed = null;
	}

	// Synchronous-only check: if a guest with localStorage chats just signed in,
	// flag the sync prompt. Reading localStorage is sync; no Supabase calls here
	// (would re-trigger the deadlock described above).
	if (_event === 'SIGNED_IN' && user && typeof window !== 'undefined') {
		try {
			const raw = localStorage.getItem('unichat_chats');
			const arr = raw ? JSON.parse(raw) : [];
			if (Array.isArray(arr) && arr.length > 0) {
				pendingSyncDecision = true;
			}
		} catch {
			// Corrupt JSON — ignore, don't prompt
		}
	}

	// Detect unexpected session loss (refresh-token failure, server-side
	// revoke, expiry past the refresh window). User-initiated sign-out
	// suppresses this via the _userInitiatedSignOut flag set in signOut().
	if (_event === 'SIGNED_OUT') {
		if (_wasAuthenticated && !_userInitiatedSignOut) {
			sessionExpired = true;
		}
		_wasAuthenticated = false;
		_userInitiatedSignOut = false;
	}
});

export const authStore = {
	get user() {
		return user;
	},
	get session() {
		return session;
	},
	get loading() {
		return loading;
	},
	get tier() {
		return tier;
	},
	get isAuthenticated() {
		return !!user;
	},
	get pendingSyncDecision() {
		return pendingSyncDecision;
	},
	clearSyncDecision() {
		pendingSyncDecision = false;
	},
	get sessionExpired() {
		return sessionExpired;
	},
	acknowledgeSessionExpired() {
		sessionExpired = false;
	},
	get onboardingDismissed() {
		return onboardingDismissed;
	},
	// Optimistic write: flip the local state immediately so the tour
	// hides without waiting on the network round-trip; persist to DB
	// in the background. We don't revert on error — better to keep it
	// dismissed locally than re-show the tour on a one-off network blip.
	async dismissOnboarding() {
		if (!user) return;
		onboardingDismissed = true;
		const { error } = await supabase
			.from('profiles')
			.update({ onboarding_dismissed: true })
			.eq('id', user.id);
		if (error) console.error('[auth] dismissOnboarding failed:', error.message);
	},

	get displayName() {
		if (!user) return null;
		return (
			user.user_metadata?.full_name ??
			user.user_metadata?.name ??
			user.email?.split('@')[0] ??
			'User'
		);
	},

	get avatarUrl() {
		return user?.user_metadata?.avatar_url ?? null;
	},

	async signInWithGoogle() {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: window.location.origin },
		});
		if (error) console.error('Sign in error:', error.message);
	},

	async signOut() {
		// Mark before awaiting so the onAuthStateChange SIGNED_OUT handler
		// suppresses the expired-session prompt (this isn't an unexpected
		// expiry — the user clicked the button).
		_userInitiatedSignOut = true;
		const { error } = await supabase.auth.signOut();
		if (error) {
			console.error('Sign out error:', error.message);
			_userInitiatedSignOut = false;
		}
	},

	getAccessToken(): string | undefined {
		return session?.access_token;
	},
};
