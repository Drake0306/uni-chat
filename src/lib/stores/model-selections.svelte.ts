// Per-user starred-model selections, synced via Supabase.
// Drives which models appear in the chat composer's model selector.
//
// Storage shape: one row per (user_id, model_id) in user_model_selections.
// Empty DB for an authenticated user = first time → we seed with
// DEFAULT_RECOMMENDED so subsequent toggles can use plain insert/delete
// against real rows. Guests stay in-memory only with the same defaults.

import { SvelteSet } from 'svelte/reactivity';
import { supabase } from '$lib/supabase.js';
import { authStore } from '$lib/stores/auth.svelte.js';
import { DEFAULT_RECOMMENDED } from '$lib/config/models.js';

const selections = new SvelteSet<string>(DEFAULT_RECOMMENDED);
let loaded = $state(false);
let supabaseAvailable = true;

function replaceSelections(ids: Iterable<string>) {
	selections.clear();
	for (const id of ids) selections.add(id);
}

export const selectionsStore = {
	get selections() {
		return selections;
	},
	get loaded() {
		return loaded;
	},
	has(modelId: string): boolean {
		return selections.has(modelId);
	},

	async loadSelections() {
		if (!authStore.isAuthenticated) {
			// Guests / signed-out: defaults only, no DB call.
			replaceSelections(DEFAULT_RECOMMENDED);
			loaded = true;
			return;
		}

		if (!supabaseAvailable) {
			replaceSelections(DEFAULT_RECOMMENDED);
			loaded = true;
			return;
		}

		const userId = authStore.user?.id;
		if (!userId) {
			replaceSelections(DEFAULT_RECOMMENDED);
			loaded = true;
			return;
		}

		try {
			const { data, error } = await supabase
				.from('user_model_selections')
				.select('model_id');
			if (error) throw error;
			const rows = data ?? [];

			if (rows.length === 0) {
				// First time for this user — seed DB with the recommended
				// defaults so future toggles operate on real rows.
				const ids = [...DEFAULT_RECOMMENDED];
				const { error: insertErr } = await supabase
					.from('user_model_selections')
					.insert(ids.map((model_id) => ({ user_id: userId, model_id })));
				if (insertErr) {
					// Couldn't seed — fall back to in-memory defaults; toggles
					// will still try to persist individually.
					console.warn('[selections] seed failed, using defaults in-memory:', insertErr);
				}
				replaceSelections(ids);
			} else {
				replaceSelections(rows.map((r) => r.model_id as string));
			}
			loaded = true;
		} catch (err) {
			console.warn('[selections] load failed, using defaults:', err);
			supabaseAvailable = false;
			replaceSelections(DEFAULT_RECOMMENDED);
			loaded = true;
		}
	},

	/** Toggle a single model's starred state. Optimistic; reverts on failure. */
	async toggle(modelId: string) {
		const wasSelected = selections.has(modelId);
		if (wasSelected) selections.delete(modelId);
		else selections.add(modelId);

		if (!authStore.isAuthenticated) return;
		const userId = authStore.user?.id;
		if (!userId) return;

		try {
			if (wasSelected) {
				const { error } = await supabase
					.from('user_model_selections')
					.delete()
					.eq('user_id', userId)
					.eq('model_id', modelId);
				if (error) throw error;
			} else {
				// Upsert — survives the rare case of a leftover row from a
				// failed delete on the same key.
				const { error } = await supabase
					.from('user_model_selections')
					.upsert({ user_id: userId, model_id: modelId });
				if (error) throw error;
			}
		} catch (err) {
			console.error('[selections] toggle persist failed, reverting:', err);
			// Revert the optimistic change.
			if (wasSelected) selections.add(modelId);
			else selections.delete(modelId);
		}
	},

	/** Add the recommended subset to current selections (additive — keeps the user's other stars). */
	async selectRecommended() {
		const userId = authStore.user?.id;
		const toAdd = [...DEFAULT_RECOMMENDED].filter((id) => !selections.has(id));
		if (toAdd.length === 0) return;

		for (const id of toAdd) selections.add(id);

		if (!authStore.isAuthenticated || !userId) return;
		try {
			const { error } = await supabase
				.from('user_model_selections')
				.upsert(toAdd.map((model_id) => ({ user_id: userId, model_id })));
			if (error) throw error;
		} catch (err) {
			console.error('[selections] selectRecommended persist failed:', err);
			// Revert.
			for (const id of toAdd) selections.delete(id);
		}
	},

	/** Clear every selection. */
	async unselectAll() {
		const previous = [...selections];
		selections.clear();

		const userId = authStore.user?.id;
		if (!authStore.isAuthenticated || !userId) return;
		try {
			const { error } = await supabase
				.from('user_model_selections')
				.delete()
				.eq('user_id', userId);
			if (error) throw error;
		} catch (err) {
			console.error('[selections] unselectAll persist failed, reverting:', err);
			replaceSelections(previous);
		}
	},
};
