// File attached to a user message. Separated from `content` so the user's
// bubble can render a clean message + chips while the LLM still receives
// the embedded text (assembled at send time by combineForLLM in chat-view).
//
// V1 only carries text — PDFs are extracted client-side via PDF.js, code/
// text files via File.text(). V2 will add image data URLs (base64) routed
// to provider-specific image_url / inline_data shapes.
export type Attachment = {
	name: string;
	mimeType: string;
	pageCount?: number; // PDFs only
	text: string;
};

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
