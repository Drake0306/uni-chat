import { supabase } from '$lib/supabase.js';
import type { User, Session } from '@supabase/supabase-js';

let user = $state<User | null>(null);
let session = $state<Session | null>(null);
let loading = $state(true);
let tier = $state<'guest' | 'free' | 'pro' | 'max'>('guest');
let pendingSyncDecision = $state(false);

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

	if (user) {
		// Fire-and-forget — does NOT block the callback
		supabase
			.from('profiles')
			.select('tier')
			.eq('id', user.id)
			.single()
			.then(
				({ data }) => {
					tier = (data?.tier as typeof tier) ?? 'free';
				},
				() => {
					tier = 'free';
				}
			);
	} else {
		tier = 'guest';
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
		const { error } = await supabase.auth.signOut();
		if (error) console.error('Sign out error:', error.message);
	},

	getAccessToken(): string | undefined {
		return session?.access_token;
	},
};
