-- Pin support for chats. New chats default to unpinned (false), so all
-- existing rows are unpinned automatically.
alter table public.chats
  add column pinned boolean not null default false;

-- Composite index so the sidebar's three queries (pinned, today-unpinned,
-- older-unpinned) all hit an index. Sorted by updated_at desc to match the
-- query order.
create index idx_chats_user_pinned_updated on public.chats(user_id, pinned, updated_at desc);
