-- Storage bucket for chat image attachments (V2).
-- Private bucket; access via signed URLs only.
--
-- Path layout: <user_id>/<chat_id>/<message_id>/<filename>
-- The first path segment is always the owner's auth.uid() — RLS policies
-- below gate read/write/delete via storage.foldername(name)[1].
--
-- Text/PDF attachments do NOT use this bucket — their extracted text lives
-- inline in the messages.attachments JSONB column (see migration
-- 20260429160000_message_attachments.sql). Storage is reserved for binary
-- payloads (images today, native PDFs / videos later) where round-tripping
-- through the DB row would be wasteful.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'chat-attachments',
	'chat-attachments',
	false,
	26214400, -- 25 MB per file (matches MAX_FILE_BYTES in src/lib/file-extract.ts)
	array[
		'image/png',
		'image/jpeg',
		'image/jpg',
		'image/webp',
		'image/gif',
		'image/heic',
		'image/heif'
	]
)
on conflict (id) do nothing;

-- ── RLS policies ────────────────────────────────────────────────────
-- storage.objects has RLS enabled by default on Supabase. Policies below
-- restrict each authenticated user to their own user_id-prefixed folder.
-- `drop policy if exists` makes the migration safe to re-apply.

drop policy if exists "Users read own chat attachments" on storage.objects;
create policy "Users read own chat attachments"
	on storage.objects for select
	to authenticated
	using (
		bucket_id = 'chat-attachments'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

drop policy if exists "Users upload chat attachments to own folder" on storage.objects;
create policy "Users upload chat attachments to own folder"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'chat-attachments'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

drop policy if exists "Users delete own chat attachments" on storage.objects;
create policy "Users delete own chat attachments"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'chat-attachments'
		and (storage.foldername(name))[1] = auth.uid()::text
	);
