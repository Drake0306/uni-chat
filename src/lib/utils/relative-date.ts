// Compact relative-time formatter for chat list rows.
//
// Returns short, ambient labels:
//   < 1 min        → "Just now"
//   < 1 hour       → "5m ago"
//   < 24 hours     → "3h ago"
//   yesterday      → "Yesterday"
//   < 7 days       → "Mon"
//   same year      → "Mar 12"
//   different year → "Mar 12, 2024"
//
// Designed for tight horizontal spaces (one-row chat items, badge-like).
// Not for "the user is reading this and wants exactness" contexts — those
// should use the ISO date directly or a full toLocaleString.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatRelative(value: string | Date, now: Date = new Date()): string {
	const d = typeof value === 'string' ? new Date(value) : value;
	if (isNaN(d.getTime())) return '';

	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60_000);
	const diffHr = Math.floor(diffMs / 3_600_000);

	if (diffMin < 1) return 'Just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;

	// Compute calendar-day delta independent of clock-time so "yesterday"
	// works correctly across midnight (e.g. 11pm Tuesday → 1am Wednesday
	// is still "Yesterday", not "2h ago").
	const dayDiff = calendarDayDiff(now, d);
	if (dayDiff === 1) return 'Yesterday';
	if (dayDiff < 7) return DAY_NAMES[d.getDay()];

	const sameYear = d.getFullYear() === now.getFullYear();
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: sameYear ? undefined : 'numeric',
	});
}

function calendarDayDiff(a: Date, b: Date): number {
	const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
	const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
	return Math.round((ad - bd) / 86_400_000);
}

// Bucket label for grouping a chat list. Pairs with formatRelative but is
// coarser — only the few buckets a sectioned UI needs.
export type DateBucket = 'Today' | 'Yesterday' | 'This week' | 'This month' | 'Older';

export function dateBucket(value: string | Date, now: Date = new Date()): DateBucket {
	const d = typeof value === 'string' ? new Date(value) : value;
	if (isNaN(d.getTime())) return 'Older';

	const dayDiff = calendarDayDiff(now, d);
	if (dayDiff <= 0) return 'Today';
	if (dayDiff === 1) return 'Yesterday';
	if (dayDiff < 7) return 'This week';
	const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
	if (sameMonth) return 'This month';
	return 'Older';
}
