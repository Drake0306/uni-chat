-- Per-message file attachments (V1 — extracted text only).
-- Decouples the user's typed message from any attached file content so the
-- bubble can render `content` + chips for each file instead of dumping the
-- raw fenced text into the message body. The LLM still receives the
-- combined payload (handled client-side at send time).
--
-- JSONB shape: Attachment[] — see src/lib/types.ts.
--   [{ "name": "report.pdf", "mimeType": "application/pdf",
--      "pageCount": 5, "text": "<extracted>" }, ...]

alter table public.messages
	add column if not exists attachments jsonb;
