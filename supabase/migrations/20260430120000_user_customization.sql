-- Per-user customization preferences. Surfaced in settings → Customization
-- and used to personalize chat (e.g. as a system-prompt prefix). All fields
-- are optional; nulls / empty arrays mean the user hasn't filled them in yet.
--
-- - custom_name: how the assistant should address the user (free-form, ≤50 chars enforced client-side)
-- - custom_occupation: what the user does (≤100 chars)
-- - custom_traits: tags describing the desired assistant tone/style (text[])
-- - custom_about: free-form context the user wants the assistant to know (≤3000 chars)
-- - hide_personal_info: when true, the UI hides the user's name / email
--   in chrome (sidebar avatar caption, settings header, etc.)
-- - stats_for_nerds: when true, message bubbles show tokens/sec, time-to-first-token,
--   and estimated token counts.
--
-- Defaults match the previous client-only state: empty strings / empty array / false.

alter table public.profiles
	add column if not exists custom_name text not null default '',
	add column if not exists custom_occupation text not null default '',
	add column if not exists custom_traits text[] not null default '{}',
	add column if not exists custom_about text not null default '',
	add column if not exists hide_personal_info boolean not null default false,
	add column if not exists stats_for_nerds boolean not null default false;
