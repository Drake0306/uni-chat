// Supabase Storage helper for image attachments. Lives separately from
// file-extract.ts because images don't go through the text-extraction
// pipeline — they're uploaded raw to the `chat-attachments` bucket
// (created by migration 20260429180000_chat_attachments_storage.sql) and
// later referenced by signed URL.
//
// Path layout per the migration:
//   <user_id>/<chat_id>/<message_id>/<filename>
// The first segment must equal auth.uid() — RLS policies on storage.objects
// gate every read/write/delete by that prefix.

import { supabase } from '$lib/supabase.js';

const BUCKET = 'chat-attachments';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
const SIGNED_URL_REFRESH_BEFORE_MS = 60_000; // refresh if <1 min remaining

// Strips path-traversal / control characters so a hostile filename can't
// escape the user's folder. Allows letters, digits, dot, underscore, dash;
// everything else becomes underscore. Empty or all-stripped names fall back
// to "file" so we never produce a zero-length segment.
function sanitizeFilename(name: string): string {
	const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[.]+/, '_');
	return cleaned.length > 0 ? cleaned : 'file';
}

/**
 * Uploads a single image to the chat-attachments bucket.
 * Returns the storage path for persistence on the message; the caller
 * generates signed URLs lazily on display via getSignedImageUrl().
 *
 * `indexHint` is the position in the per-message batch (0, 1, 2, ...).
 * Required when more than one image is uploaded in a single send to
 * avoid path collisions: two files whose names sanitize to the same
 * string ("résumé.pdf" + "re_sume_.pdf", or "a b.png" + "a_b.png")
 * would collapse to one storage path under the same messageId, and
 * `upsert:false` would throw on the second upload — silently dropping
 * it from the persisted attachments array. Prefixing each path with
 * the batch index disambiguates them.
 *
 * Throws on RLS / network / quota failures. Caller should wrap in
 * try/catch and surface the message to the user.
 */
export async function uploadImageToStorage(
	file: File,
	userId: string,
	chatId: string,
	messageId: string,
	indexHint = 0
): Promise<{ storagePath: string }> {
	const safeName = sanitizeFilename(file.name);
	const storagePath = `${userId}/${chatId}/${messageId}/${indexHint}_${safeName}`;

	const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
		contentType: file.type || 'application/octet-stream',
		// upsert:false because the (chatId, messageId) tuple is unique per send.
		// A collision would mean we re-used a messageId, which is a bug worth
		// surfacing rather than silently overwriting.
		upsert: false,
	});

	if (error) {
		throw new Error(`Failed to upload ${file.name}: ${error.message}`);
	}

	return { storagePath };
}

// In-memory signed-URL cache. Supabase generates a signed URL via a
// JWT-signed token, so the URL itself can be cached up to its expiry.
// LRU-bounded so a long browsing session over many chats doesn't leak —
// inserts re-set the entry to the end, evictions drop the oldest.
const SIGNED_URL_CACHE_MAX = 200;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
function rememberSignedUrl(key: string, value: { url: string; expiresAt: number }) {
	if (signedUrlCache.has(key)) signedUrlCache.delete(key); // refresh recency
	signedUrlCache.set(key, value);
	if (signedUrlCache.size > SIGNED_URL_CACHE_MAX) {
		const oldest = signedUrlCache.keys().next().value;
		if (oldest !== undefined) signedUrlCache.delete(oldest);
	}
}

/**
 * Wipes the in-memory signed-URL cache. Called on sign-out so a different
 * user signing into the same tab can't fetch images via cached URLs that
 * were minted for the previous session — Supabase signed URLs are valid
 * for an hour regardless of session state.
 */
export function clearSignedUrlCache(): void {
	signedUrlCache.clear();
}

/**
 * Returns a temporary signed URL for displaying or fetching an image.
 * Cached in-memory until ~1 minute before expiry. Returns null on RLS or
 * network failure (caller should render a fallback / error chip).
 */
export async function getSignedImageUrl(storagePath: string): Promise<string | null> {
	const cached = signedUrlCache.get(storagePath);
	if (cached && cached.expiresAt > Date.now() + SIGNED_URL_REFRESH_BEFORE_MS) {
		return cached.url;
	}

	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

	if (error || !data?.signedUrl) {
		console.error('[image-storage] createSignedUrl failed:', error?.message);
		return null;
	}

	rememberSignedUrl(storagePath, {
		url: data.signedUrl,
		expiresAt: Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
	});
	return data.signedUrl;
}

/**
 * Removes every Storage object for a deleted chat. Called from
 * chatStore.deleteChat as fire-and-forget — Storage failures shouldn't
 * block the user-visible chat row deletion.
 *
 * Path layout `<userId>/<chatId>/<messageId>/<filename>` means a single
 * chat can fan out to many message-id sub-folders. Supabase's `list()`
 * returns immediate children only, so we walk one level (each messageId)
 * and collect leaf files for a single bulk `remove()`.
 *
 * RLS on storage.objects already restricts to the caller's own folder,
 * so even if a stale chatId leaked, this can't delete another user's data.
 */
export async function deleteChatImages(userId: string, chatId: string): Promise<void> {
	const chatPrefix = `${userId}/${chatId}`;
	const { data: messageFolders, error: listErr } = await supabase.storage
		.from(BUCKET)
		.list(chatPrefix, { limit: 1000 });
	if (listErr || !messageFolders) return;
	if (messageFolders.length === 0) return;

	const allPaths: string[] = [];
	for (const folder of messageFolders) {
		// Folders show up as items with no metadata file size — but for our
		// flat layout there's only ever one level of nesting; trying list()
		// on each is cheap and handles both cases.
		const folderPath = `${chatPrefix}/${folder.name}`;
		const { data: files } = await supabase.storage.from(BUCKET).list(folderPath, { limit: 1000 });
		if (files) {
			for (const f of files) allPaths.push(`${folderPath}/${f.name}`);
		}
		// Also drop URL-cache entries for this prefix so future renders
		// don't try to use a path we just removed.
		for (const key of [...signedUrlCache.keys()]) {
			if (key.startsWith(folderPath)) signedUrlCache.delete(key);
		}
	}

	if (allPaths.length === 0) return;
	const { error: removeErr } = await supabase.storage.from(BUCKET).remove(allPaths);
	if (removeErr) {
		console.error('[image-storage] cleanup failed for chat', chatId, removeErr.message);
	}
}
