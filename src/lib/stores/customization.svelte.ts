// Per-user customization preferences. Surfaces in settings → Customization.
//
// Persistence model:
// - localStorage cache for guests (and as a fast first paint for authed users).
// - Supabase profiles row is the source of truth across devices.
// - Auth store calls syncFromDb() once the profile fetch returns, which
//   overrides localStorage.
//
// Unlike the colors / code-block stores, customization is a batch save —
// the user types into a form and clicks "Save Preferences," so we expose
// a single save() that takes the whole shape rather than per-field setters.

import { supabase } from '$lib/supabase.js';

const STORAGE_KEY = 'unichat_customization';

export type CustomizationState = {
	name: string;
	occupation: string;
	traits: string[];
	about: string;
	hidePersonalInfo: boolean;
	statsForNerds: boolean;
};

export const MAX_NAME_LEN = 50;
export const MAX_OCCUPATION_LEN = 100;
export const MAX_ABOUT_LEN = 3000;
export const MAX_TRAITS = 50;

// Per-tier caps applied at BOTH input time (UI maxlength + counters) and
// inject time (truncation in buildPersonalizationPrompt). Storage caps in
// the DB stay at the schema max (MAX_ABOUT_LEN / MAX_TRAITS) so an upgrade
// instantly unlocks the larger values without re-typing.
//
// Guests don't get personalization at all — gated upstream.
export type PersonalizationTier = 'free' | 'pro' | 'max';

export type TierCaps = {
	name: number;
	occupation: number;
	traits: number;
	about: number;
};

export const TIER_CAPS: Record<PersonalizationTier, TierCaps> = {
	free: { name: MAX_NAME_LEN, occupation: MAX_OCCUPATION_LEN, traits: 5, about: 500 },
	pro: { name: MAX_NAME_LEN, occupation: MAX_OCCUPATION_LEN, traits: 15, about: 1500 },
	max: { name: MAX_NAME_LEN, occupation: MAX_OCCUPATION_LEN, traits: MAX_TRAITS, about: MAX_ABOUT_LEN },
};

// Resolve a possibly-unknown tier (e.g. 'guest', undefined) to the closest
// safe caps. Guest collapses to 'free' for sizing purposes — the UI never
// shows the form to guests, but we want safe defaults if it ever does.
export function getTierCaps(tier: string | null | undefined): TierCaps {
	if (tier === 'pro') return TIER_CAPS.pro;
	if (tier === 'max') return TIER_CAPS.max;
	return TIER_CAPS.free;
}

// Build the system prompt that personalizes the assistant's behavior to the
// user's stored profile. Returns null when the user hasn't filled in any
// fields, so the caller can skip prepending entirely (don't pay tokens for
// an empty preamble).
//
// Tier caps truncate field-by-field. We slice rather than reject so that
// a downgrade preserves a useful prefix of the longer content.
export function buildPersonalizationPrompt(
	c: CustomizationState,
	tier: string | null | undefined
): string | null {
	const caps = getTierCaps(tier);
	const name = c.name.trim().slice(0, caps.name);
	const occupation = c.occupation.trim().slice(0, caps.occupation);
	const about = c.about.trim().slice(0, caps.about);
	const traits = c.traits.slice(0, caps.traits);

	if (!name && !occupation && !about && traits.length === 0) return null;

	const aboutLines: string[] = [];
	if (name) aboutLines.push(`- Name: ${name}`);
	if (occupation) aboutLines.push(`- They work as: ${occupation}`);
	if (about) aboutLines.push(`- More about them: ${about}`);

	const sections: string[] = [
		"You are speaking with the following user. Use this context to personalize your responses — match their preferred tone, lean on their background when it helps, and address them by name when it feels natural.",
	];
	if (aboutLines.length > 0) {
		sections.push(`About the user:\n${aboutLines.join('\n')}`);
	}
	if (traits.length > 0) {
		sections.push(`The user prefers responses that are: ${traits.join(', ')}.`);
	}
	sections.push(
		"Always respond politely and respectfully, regardless of the preferences above. Don't contradict this context unless the user asks."
	);
	return sections.join('\n\n');
}

const EMPTY: CustomizationState = {
	name: '',
	occupation: '',
	traits: [],
	about: '',
	hidePersonalInfo: false,
	statsForNerds: false,
};

function readStored(): CustomizationState {
	if (typeof window === 'undefined') return { ...EMPTY };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...EMPTY };
		const parsed = JSON.parse(raw);
		return normalize(parsed);
	} catch {
		return { ...EMPTY };
	}
}

function normalize(input: unknown): CustomizationState {
	const out: CustomizationState = { ...EMPTY };
	if (!input || typeof input !== 'object') return out;
	const r = input as Record<string, unknown>;
	if (typeof r.name === 'string') out.name = r.name.slice(0, MAX_NAME_LEN);
	if (typeof r.occupation === 'string') out.occupation = r.occupation.slice(0, MAX_OCCUPATION_LEN);
	if (Array.isArray(r.traits)) {
		out.traits = r.traits
			.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
			.map((t) => t.trim())
			.slice(0, MAX_TRAITS);
	}
	if (typeof r.about === 'string') out.about = r.about.slice(0, MAX_ABOUT_LEN);
	if (typeof r.hidePersonalInfo === 'boolean') out.hidePersonalInfo = r.hidePersonalInfo;
	if (typeof r.statsForNerds === 'boolean') out.statsForNerds = r.statsForNerds;
	return out;
}

function persistLocal(value: CustomizationState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch {
		// privacy mode / quota — ignore
	}
}

let state = $state<CustomizationState>(readStored());

export const customizationStore = {
	get value(): CustomizationState {
		return state;
	},
	get name() {
		return state.name;
	},
	get occupation() {
		return state.occupation;
	},
	get traits() {
		return state.traits;
	},
	get about() {
		return state.about;
	},
	get hidePersonalInfo() {
		return state.hidePersonalInfo;
	},
	get statsForNerds() {
		return state.statsForNerds;
	},

	// Called by the auth store once the profile row arrives. DB beats
	// localStorage. Each row in the DB shape uses snake_case; this method
	// accepts the raw row so the auth store doesn't have to translate.
	syncFromDb(row: {
		custom_name?: string | null;
		custom_occupation?: string | null;
		custom_traits?: string[] | null;
		custom_about?: string | null;
		hide_personal_info?: boolean | null;
		stats_for_nerds?: boolean | null;
	}) {
		const next: CustomizationState = normalize({
			name: row.custom_name ?? '',
			occupation: row.custom_occupation ?? '',
			traits: row.custom_traits ?? [],
			about: row.custom_about ?? '',
			hidePersonalInfo: row.hide_personal_info ?? false,
			statsForNerds: row.stats_for_nerds ?? false,
		});
		state = next;
		persistLocal(next);
	},

	// Batch save: validates + clamps, writes locally, then writes to DB
	// if the user is authenticated. Returns true on success, false on
	// DB failure (local cache is still updated optimistically).
	async save(input: CustomizationState, userId: string | null): Promise<boolean> {
		const next = normalize(input);
		state = next;
		persistLocal(next);
		if (!userId) return true;
		const { error } = await supabase
			.from('profiles')
			.update({
				custom_name: next.name,
				custom_occupation: next.occupation,
				custom_traits: next.traits,
				custom_about: next.about,
				hide_personal_info: next.hidePersonalInfo,
				stats_for_nerds: next.statsForNerds,
			})
			.eq('id', userId);
		if (error) {
			console.error('[customization] persist failed:', error.message);
			return false;
		}
		return true;
	},
};
