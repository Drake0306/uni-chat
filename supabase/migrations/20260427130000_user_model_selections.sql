-- Per-user starred-model list. Drives which models appear in the chat
-- composer's model selector. Synced across devices via Supabase.
--
-- model_id is free-text (not an FK) because the model catalog lives in
-- code (src/lib/config/models.ts), not in the database.

create table user_model_selections (
  user_id uuid not null references profiles(id) on delete cascade,
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

alter table user_model_selections enable row level security;

create policy "users read their own selections"
  on user_model_selections for select
  using (auth.uid() = user_id);

create policy "users manage their own selections"
  on user_model_selections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
