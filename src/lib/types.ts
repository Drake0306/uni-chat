// File attached to a user message. Separated from `content` so the user's
// bubble can render a clean message + chips while the LLM still receives
// the embedded text or image at send time.
//
// Discriminated by `kind`. Text attachments (PDFs and code/text files)
// extract to text client-side via PDF.js / File.text() and carry the
// extracted body inline in the JSONB row. Image attachments are uploaded
// to Supabase Storage at send time; the row stores the storage path and
// chat-view fetches a signed URL on read.
//
// Legacy rows from before the discriminator was added (saved via the
// V1 attachments column) have shape { name, mimeType, pageCount?, text }
// with no `kind` field. mapMessageRow / loadFromLocalStorage normalize
// those to TextAttachment on read by defaulting `kind: 'text'`.

export type TextAttachment = {
	kind: 'text';
	name: string;
	mimeType: string;
	pageCount?: number; // PDFs only
	text: string;
};

export type ImageAttachment = {
	kind: 'image';
	name: string;
	mimeType: string;
	// Storage object path: "<user_id>/<chat_id>/<message_id>/<filename>".
	// Signed URLs are generated per-read via supabase.storage.from(...)
	// .createSignedUrl(); we don't persist URLs because they expire.
	storagePath: string;
	// Useful for the renderer to reserve layout space before the image
	// loads and avoid layout shift.
	width?: number;
	height?: number;
};

export type Attachment = TextAttachment | ImageAttachment;

// OpenAI-shape content blocks for the LLM request body. Used when a message
// carries image attachments — the chat-view payload builder switches from
// flat string content to this array form. Provider routes that already
// accept OpenAI shape (OpenRouter, Mistral, Groq, OpenAI) pass these through
// unchanged; the Gemini transformer maps each block to a Gemini Part
// (image_url → inline_data after base64-encoding the fetched bytes).
export type LLMContentBlock =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	reasoning?: string;
	isThinking?: boolean;
	modelName?: string;
	isError?: boolean;
	attachments?: Attachment[];
};

export type Chat = {
	id: string;
	title: string;
	modelId?: string;
	companyId?: string;
	createdAt: string;
	updatedAt: string;
	pinned?: boolean;
};
