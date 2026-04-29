-- Per-user code-block accordion behavior.
-- - code_block_auto_collapse: master switch for the auto-collapse-when-long
--   feature. False keeps every code block expanded regardless of length.
-- - code_block_collapse_lines: when auto-collapse is on, blocks longer than
--   this line count collapse on initial render. Default matches the previous
--   hard-coded threshold (10) so existing users see no behavioral change.
-- Synced via the code-block-settings client store; affects all chats.

alter table public.profiles
	add column if not exists code_block_auto_collapse boolean not null default true,
	add column if not exists code_block_collapse_lines integer not null default 10;
