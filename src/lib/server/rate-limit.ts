type Usage = { timestamps: number[] };
const store = new Map<string, Usage>();

// ─── Rate Limit Windows ──────────────────────────────────────────
// Modeled after T3 Chat (Apr 2026), kept slightly under their limits
// so we never exceed our upstream API costs.
//
// T3 Chat reference:
//   Guest:   ~5-10 total messages to try it out
//   Free:    ~20 messages/day, resets daily
//   Pro:     usage bar resets every 4h (~33/window), ~200/day, 1500/mo
//   Premier: much higher
//
// Our limits (conservative — under T3 to stay profitable):
//   Guest:   3/hr, 8/day              (just enough to try it)
//   Free:    5/4h, 15/day             (encourages subscription)
//   Pro:     25/4h, 150/day, 1000/mo  (solid daily use)
//   Max:     60/4h, 400/day, 3000/mo  (power users)

type WindowLimit = {
	windowMs: number;
	max: number;
};

type TierLimits = WindowLimit[];

const HOUR = 3_600_000;
const FOUR_HOURS = 4 * HOUR;
const DAY = 86_400_000;
const MONTH = 30 * DAY;

const LIMITS: Record<string, TierLimits> = {
	guest: [
		{ windowMs: HOUR, max: 3 },
		{ windowMs: DAY, max: 8 },
	],
	free: [
		{ windowMs: FOUR_HOURS, max: 5 },
		{ windowMs: DAY, max: 15 },
	],
	pro: [
		{ windowMs: FOUR_HOURS, max: 25 },
		{ windowMs: DAY, max: 150 },
		{ windowMs: MONTH, max: 1000 },
	],
	max: [
		{ windowMs: FOUR_HOURS, max: 60 },
		{ windowMs: DAY, max: 400 },
		{ windowMs: MONTH, max: 3000 },
	],
};

export type Tier = keyof typeof LIMITS;

export function checkRateLimit(
	key: string,
	tier: Tier = 'guest',
	env?: { BYPASS_RATE_LIMIT?: string }
): { allowed: boolean; retryAfter?: number } {
	if (env?.BYPASS_RATE_LIMIT === 'true') {
		return { allowed: true };
	}

	const now = Date.now();
	const tierLimits = LIMITS[tier] ?? LIMITS.guest;

	let usage = store.get(key);
	if (!usage) {
		usage = { timestamps: [] };
		store.set(key, usage);
	}

	// Prune entries older than the largest window
	const maxWindow = Math.max(...tierLimits.map((l) => l.windowMs));
	usage.timestamps = usage.timestamps.filter((t) => t > now - maxWindow);

	// Check each window from smallest to largest
	for (const limit of tierLimits) {
		const windowStart = now - limit.windowMs;
		const windowTimestamps = usage.timestamps.filter((t) => t > windowStart);

		if (windowTimestamps.length >= limit.max) {
			const oldestInWindow = windowTimestamps[0];
			return {
				allowed: false,
				retryAfter: Math.ceil((oldestInWindow + limit.windowMs - now) / 1000),
			};
		}
	}

	usage.timestamps.push(now);
	return { allowed: true };
}
