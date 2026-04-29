// Per-user code-block accordion behavior. Mirrors the colors store pattern:
// reads localStorage on import (sync) so the renderer picks up the user's
// choice on first paint, persists to Supabase profiles when authenticated
// so it follows the user across devices.
//
// Two settings:
// - autoCollapse: master switch. If false, code blocks never auto-collapse;
//   they stay expanded regardless of length. User can still toggle individual
//   blocks via the Expand / Collapse button.
// - collapseLines: when autoCollapse is true, code blocks longer than this
//   line count auto-collapse on initial render. Has no effect during
//   streaming — the renderer always shows full code while it's generating
//   so the user can watch the model write it.

import { supabase } from '$lib/supabase.js';

const AUTO_KEY = 'unichat_code_block_auto_collapse';
const LINES_KEY = 'unichat_code_block_collapse_lines';

const DEFAULT_AUTO = true;
const DEFAULT_LINES = 10;

function readAutoStored(): boolean {
	if (typeof window === 'undefined') return DEFAULT_AUTO;
	try {
		const v = localStorage.getItem(AUTO_KEY);
		if (v === 'true') return true;
		if (v === 'false') return false;
	} catch {
		// privacy mode / quota
	}
	return DEFAULT_AUTO;
}

function readLinesStored(): number {
	if (typeof window === 'undefined') return DEFAULT_LINES;
	try {
		const v = localStorage.getItem(LINES_KEY);
		if (v) {
			const n = parseInt(v, 10);
			if (Number.isFinite(n) && n >= 1 && n <= 1000) return n;
		}
	} catch {
		// ignore
	}
	return DEFAULT_LINES;
}

let autoCollapse = $state<boolean>(readAutoStored());
let collapseLines = $state<number>(readLinesStored());

function persistAuto(value: boolean) {
	try {
		localStorage.setItem(AUTO_KEY, String(value));
	} catch {
		// ignore
	}
}

function persistLines(value: number) {
	try {
		localStorage.setItem(LINES_KEY, String(value));
	} catch {
		// ignore
	}
}

// Clamp at the boundary the DB column allows. The renderer also tolerates
// out-of-range values, but we keep the input range tight in the UI.
function clampLines(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_LINES;
	return Math.max(1, Math.min(1000, Math.floor(n)));
}

export const codeBlockSettings = {
	get autoCollapse() {
		return autoCollapse;
	},
	get collapseLines() {
		return collapseLines;
	},
	// Called by the auth store after the profile row arrives. DB beats local.
	syncFromDb(opts: { autoCollapse?: boolean | null; collapseLines?: number | null }) {
		if (typeof opts.autoCollapse === 'boolean' && opts.autoCollapse !== autoCollapse) {
			autoCollapse = opts.autoCollapse;
			persistAuto(opts.autoCollapse);
		}
		if (typeof opts.collapseLines === 'number') {
			const n = clampLines(opts.collapseLines);
			if (n !== collapseLines) {
				collapseLines = n;
				persistLines(n);
			}
		}
	},
	async setAutoCollapse(value: boolean, userId: string | null) {
		if (autoCollapse === value) return;
		autoCollapse = value;
		persistAuto(value);
		if (userId) {
			const { error } = await supabase
				.from('profiles')
				.update({ code_block_auto_collapse: value })
				.eq('id', userId);
			if (error) console.error('[code-block-settings] persist autoCollapse failed:', error.message);
		}
	},
	async setCollapseLines(value: number, userId: string | null) {
		const n = clampLines(value);
		if (collapseLines === n) return;
		collapseLines = n;
		persistLines(n);
		if (userId) {
			const { error } = await supabase
				.from('profiles')
				.update({ code_block_collapse_lines: n })
				.eq('id', userId);
			if (error) console.error('[code-block-settings] persist collapseLines failed:', error.message);
		}
	},
};
