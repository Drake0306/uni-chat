import { supabase } from '$lib/supabase.js';
import { authStore } from '$lib/stores/auth.svelte.js';
import type { Chat, Message } from '$lib/types.js';

const STORAGE_KEY = 'unichat_chats';
const MAX_LOCAL_CHATS = 50;
const PAGE_SIZE = 30;

// Three independent lists: pinned chats (across all dates), today's
// non-pinned chats, and older non-pinned chats. The today/others split
// uses `updated_at` against local midnight captured at load time.
let pinnedChats = $state<Chat[]>([]);
let todayChats = $state<Chat[]>([]);
let otherChats = $state<Chat[]>([]);
let activeChat = $state<Chat | null>(null);
let messages = $state<Message[]>([]);
let streaming = $state(false);
// True until the first loadChats() resolves; flipped on for the brief window
// of any subsequent reload (sign-in/out) so the sidebar shows its blur-fade
// placeholder instead of popping in.
let initialLoading = $state(true);

// ── Composer state hoisted to the store ─────────────────────────────
// These need to survive the first-message goto from `/` to `/chat/<id>`,
// which unmounts ChatView and would otherwise reset local state. Same
// reason `streaming` lives here.
//
// Web search and reasoning effort are also persisted to localStorage
// (same pattern as the selected model and theme) so user preferences
// survive page reloads. Capability-gated UI hides the controls when the
// current model doesn't support the feature, but the underlying value
// is retained — switching back to a compatible model brings it back.
export type Effort = 'fast' | 'low' | 'medium' | 'high';

const WEB_SEARCH_KEY = 'unichat_web_search';
const EFFORT_KEY = 'unichat_effort';

function readStoredWebSearch(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem(WEB_SEARCH_KEY) === '1';
	} catch {
		return false;
	}
}

function readStoredEffort(): Effort {
	if (typeof window === 'undefined') return 'fast';
	try {
		const v = localStorage.getItem(EFFORT_KEY);
		if (v === 'fast' || v === 'low' || v === 'medium' || v === 'high') return v;
	} catch {
		// privacy-mode / quota — fall through
	}
	return 'fast';
}

let webSearchEnabled = $state(readStoredWebSearch());
let effort = $state<Effort>(readStoredEffort());

// Pagination for the Others list (auth users only).
let othersHasMore = $state(false);
let othersLoadingMore = $state(false);
let othersCursor: string | null = null;

// The "today" boundary in ms since epoch — local midnight, captured at load
// time. We don't recompute on every render; if the user crosses midnight in a
// session, they'll need to refresh to re-bucket.
let todayBoundaryMs = 0;

function computeTodayBoundary(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

// If Supabase DB queries fail, stop trying and use localStorage
let supabaseAvailable = true;

// ── localStorage helpers ─────────────────────────────────────────

function loadFromLocalStorage(): (Chat & { messages: Message[] })[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveToLocalStorage(data: (Chat & { messages: Message[] })[]) {
	if (typeof window === 'undefined') return;
	const pruned = data.slice(0, MAX_LOCAL_CHATS);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
}

function getLocalChat(chatId: string): (Chat & { messages: Message[] }) | undefined {
	return loadFromLocalStorage().find((c) => c.id === chatId);
}

function updateLocalChat(chatId: string, updater: (chat: Chat & { messages: Message[] }) => void) {
	const all = loadFromLocalStorage();
	const chat = all.find((c) => c.id === chatId);
	if (chat) {
		updater(chat);
		saveToLocalStorage(all);
	}
}

// ── Supabase helpers ─────────────────────────────────────────────

function mapChatRow(row: Record<string, unknown>): Chat {
	return {
		id: row.id as string,
		title: row.title as string,
		modelId: row.model_id as string | undefined,
		companyId: row.company_id as string | undefined,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
		pinned: (row.pinned as boolean) ?? false,
	};
}

function mapMessageRow(row: Record<string, unknown>): Message {
	return {
		id: row.id as string,
		role: row.role as 'user' | 'assistant',
		content: row.content as string,
		reasoning: row.reasoning as string | undefined,
		modelName: row.model_name as string | undefined,
		isError: row.is_error as boolean,
	};
}

function useSupabase() {
	return authStore.isAuthenticated && supabaseAvailable;
}

function markSupabaseUnavailable(err: unknown) {
	console.warn('Supabase DB unavailable, using localStorage:', err);
	supabaseAvailable = false;
}

// ── Store ────────────────────────────────────────────────────────

export const chatStore = {
	get pinnedChats() {
		return pinnedChats;
	},
	get todayChats() {
		return todayChats;
	},
	get otherChats() {
		return otherChats;
	},
	get activeChat() {
		return activeChat;
	},
	get messages() {
		return messages;
	},
	get streaming() {
		return streaming;
	},
	setStreaming(value: boolean) {
		streaming = value;
	},
	get webSearchEnabled() {
		return webSearchEnabled;
	},
	setWebSearchEnabled(value: boolean) {
		webSearchEnabled = value;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(WEB_SEARCH_KEY, value ? '1' : '0');
			} catch {
				// ignore quota / privacy-mode errors
			}
		}
	},
	get effort() {
		return effort;
	},
	setEffort(value: Effort) {
		effort = value;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(EFFORT_KEY, value);
			} catch {
				// ignore quota / privacy-mode errors
			}
		}
	},

	/** Push a message to the current array and trigger reactivity. */
	pushMessage(msg: Message) {
		messages = [...messages, msg];
	},

	/** Get the last message reference for streaming mutations. */
	lastMessage(): Message | undefined {
		return messages[messages.length - 1];
	},

	get othersHasMore() {
		return othersHasMore;
	},
	get othersLoadingMore() {
		return othersLoadingMore;
	},
	get initialLoading() {
		return initialLoading;
	},

	async loadChats() {
		// Reset state on every fresh load (sign-in, sign-out, initial mount).
		pinnedChats = [];
		todayChats = [];
		otherChats = [];
		othersCursor = null;
		othersHasMore = false;
		todayBoundaryMs = computeTodayBoundary();
		const todayIso = new Date(todayBoundaryMs).toISOString();
		initialLoading = true;

		try {
			if (useSupabase()) {
				try {
					// Three parallel queries: pinned (any date), today-unpinned, and
					// the first page of older-unpinned.
					const [pinnedRes, todayRes, othersRes] = await Promise.all([
						supabase
							.from('chats')
							.select('*')
							.eq('pinned', true)
							.order('updated_at', { ascending: false }),
						supabase
							.from('chats')
							.select('*')
							.eq('pinned', false)
							.gte('updated_at', todayIso)
							.order('updated_at', { ascending: false }),
						supabase
							.from('chats')
							.select('*')
							.eq('pinned', false)
							.lt('updated_at', todayIso)
							.order('updated_at', { ascending: false })
							.limit(PAGE_SIZE),
					]);
					if (pinnedRes.error) throw pinnedRes.error;
					if (todayRes.error) throw todayRes.error;
					if (othersRes.error) throw othersRes.error;

					pinnedChats = (pinnedRes.data ?? []).map(mapChatRow);
					todayChats = (todayRes.data ?? []).map(mapChatRow);
					const otherRows = othersRes.data ?? [];
					otherChats = otherRows.map(mapChatRow);
					if (otherRows.length === PAGE_SIZE) {
						othersCursor = otherRows[otherRows.length - 1].updated_at as string;
						othersHasMore = true;
					}
					return;
				} catch (err) {
					markSupabaseUnavailable(err);
				}
			}
			{
				// Guests load all of localStorage at once and split locally.
				const local = loadFromLocalStorage().map(({ messages: _, ...chat }) => chat);
				pinnedChats = local.filter((c) => c.pinned);
				const unpinned = local.filter((c) => !c.pinned);
				todayChats = unpinned.filter((c) => new Date(c.updatedAt).getTime() >= todayBoundaryMs);
				otherChats = unpinned.filter((c) => new Date(c.updatedAt).getTime() < todayBoundaryMs);
			}
		} finally {
			initialLoading = false;
		}
	},

	/** Append the next page of older non-pinned chats. No-op for guests. */
	async loadMoreOtherChats() {
		if (othersLoadingMore || !othersHasMore || !othersCursor || !useSupabase()) return;
		othersLoadingMore = true;
		try {
			const { data, error } = await supabase
				.from('chats')
				.select('*')
				.eq('pinned', false)
				.lt('updated_at', othersCursor)
				.order('updated_at', { ascending: false })
				.limit(PAGE_SIZE);
			if (error) throw error;
			const rows = data ?? [];
			if (rows.length > 0) {
				const mapped = rows.map(mapChatRow);
				otherChats = [...otherChats, ...mapped];
				othersCursor = rows[rows.length - 1].updated_at as string;
			}
			othersHasMore = rows.length === PAGE_SIZE;
		} catch (err) {
			console.error('[chats] loadMoreOtherChats failed:', err);
			othersHasMore = false;
		} finally {
			othersLoadingMore = false;
		}
	},

	/**
	 * Server-side title search. Returns up to 20 matches without touching the
	 * main `chats` list. For guests, falls back to a localStorage filter.
	 */
	async searchChats(query: string): Promise<Chat[]> {
		const q = query.trim();
		if (!q) return [];

		if (useSupabase()) {
			try {
				const { data, error } = await supabase
					.from('chats')
					.select('*')
					.ilike('title', `%${q}%`)
					.order('updated_at', { ascending: false })
					.limit(20);
				if (error) throw error;
				return data?.map(mapChatRow) ?? [];
			} catch (err) {
				console.error('[chats] searchChats failed:', err);
				return [];
			}
		}

		const lower = q.toLowerCase();
		return loadFromLocalStorage()
			.filter((c) => c.title.toLowerCase().includes(lower))
			.slice(0, 20)
			.map(({ messages: _, ...chat }) => chat);
	},

	/**
	 * Optimistic chat creation. Generates the id client-side, immediately
	 * prepends to `todayChats` (so the sidebar updates instantly), then fires
	 * the backend insert without awaiting it. The user-supplied chat id is
	 * passed to Supabase so the DB row uses the same id we already showed.
	 */
	async createChat(modelId?: string, companyId?: string): Promise<string> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const chat: Chat = {
			id,
			title: 'New Chat',
			modelId,
			companyId,
			createdAt: now,
			updatedAt: now,
			pinned: false,
		};

		// Optimistic UI update: sidebar reflects the new chat immediately.
		todayChats = [chat, ...todayChats];
		activeChat = chat;

		// AWAIT the chat insert. Subsequent calls (addMessage on the user msg,
		// updateChatTitle, the server-side tee save) target this chat by id;
		// if we don't wait, they race the chat insert and silently fail
		// (FK violation on messages, no-op UPDATE for title).
		if (useSupabase()) {
			const { error } = await supabase.from('chats').insert({
				id,
				user_id: authStore.user!.id,
				title: 'New Chat',
				model_id: modelId,
				company_id: companyId,
			});
			if (error) {
				// Roll back the optimistic UI so we don't leave a phantom chat
				// in the sidebar pointing at a row that doesn't exist in DB.
				console.error('[chats] createChat backend insert failed:', error);
				todayChats = todayChats.filter((c) => c.id !== id);
				if (activeChat?.id === id) activeChat = null;
				throw error;
			}
		} else {
			const all = loadFromLocalStorage();
			all.unshift({ ...chat, messages: [] });
			saveToLocalStorage(all);
		}

		return id;
	},

	/**
	 * Move a chat into the Pinned section. Optimistically removes from
	 * today/other and prepends to pinnedChats; reverts on backend failure.
	 */
	async pinChat(chatId: string) {
		const chat =
			todayChats.find((c) => c.id === chatId) ?? otherChats.find((c) => c.id === chatId);
		if (!chat) return; // already pinned or not found

		const wasInToday = todayChats.some((c) => c.id === chatId);
		const snapshot: Chat = { ...chat };

		// Optimistic update
		if (wasInToday) {
			todayChats = todayChats.filter((c) => c.id !== chatId);
		} else {
			otherChats = otherChats.filter((c) => c.id !== chatId);
		}
		pinnedChats = [{ ...chat, pinned: true }, ...pinnedChats];

		if (useSupabase()) {
			const { error } = await supabase
				.from('chats')
				.update({ pinned: true })
				.eq('id', chatId);
			if (error) {
				console.error('[chats] pinChat failed:', error);
				// Revert
				pinnedChats = pinnedChats.filter((c) => c.id !== chatId);
				if (wasInToday) todayChats = [snapshot, ...todayChats];
				else otherChats = [snapshot, ...otherChats];
			}
		} else {
			updateLocalChat(chatId, (c) => {
				c.pinned = true;
			});
		}
	},

	/**
	 * Unpin a chat. Optimistically moves it from pinnedChats back to today
	 * or other based on its updatedAt timestamp; reverts on backend failure.
	 */
	async unpinChat(chatId: string) {
		const chat = pinnedChats.find((c) => c.id === chatId);
		if (!chat) return;

		const snapshot: Chat = { ...chat };
		const isToday = new Date(chat.updatedAt).getTime() >= todayBoundaryMs;

		// Optimistic update
		pinnedChats = pinnedChats.filter((c) => c.id !== chatId);
		const unpinned: Chat = { ...chat, pinned: false };
		if (isToday) todayChats = [unpinned, ...todayChats];
		else otherChats = [unpinned, ...otherChats];

		if (useSupabase()) {
			const { error } = await supabase
				.from('chats')
				.update({ pinned: false })
				.eq('id', chatId);
			if (error) {
				console.error('[chats] unpinChat failed:', error);
				// Revert
				if (isToday) todayChats = todayChats.filter((c) => c.id !== chatId);
				else otherChats = otherChats.filter((c) => c.id !== chatId);
				pinnedChats = [snapshot, ...pinnedChats];
			}
		} else {
			updateLocalChat(chatId, (c) => {
				c.pinned = false;
			});
		}
	},

	/**
	 * Fetch a chat's messages without touching activeChat / messages state.
	 * Used by side-effects like title regeneration that need the conversation
	 * but shouldn't switch the user's currently-viewed chat.
	 */
	async fetchChatMessages(chatId: string): Promise<Message[]> {
		if (useSupabase()) {
			try {
				const { data, error } = await supabase
					.from('messages')
					.select('*')
					.eq('chat_id', chatId)
					.order('created_at', { ascending: true });
				if (error) throw error;
				return (data ?? []).map(mapMessageRow);
			} catch (err) {
				console.error('[chats] fetchChatMessages failed:', err);
				return [];
			}
		}
		const local = getLocalChat(chatId);
		return local?.messages ?? [];
	},

	async loadChat(chatId: string) {
		if (useSupabase()) {
			try {
				const [chatRes, msgRes] = await Promise.all([
					supabase.from('chats').select('*').eq('id', chatId).single(),
					supabase
						.from('messages')
						.select('*')
						.eq('chat_id', chatId)
						.order('created_at', { ascending: true }),
				]);
				if (chatRes.data) {
					activeChat = mapChatRow(chatRes.data);
					messages = msgRes.data?.map(mapMessageRow) ?? [];
					return;
				}
			} catch (err) {
				console.error('Failed to load chat from Supabase:', err);
			}
		}
		{
			const local = getLocalChat(chatId);
			if (local) {
				const { messages: msgs, ...chat } = local;
				activeChat = chat;
				messages = msgs;
			}
		}
	},

	async addMessage(chatId: string, message: Message) {
		if (useSupabase()) {
			try {
				await supabase.from('messages').insert({
					id: message.id,
					chat_id: chatId,
					role: message.role,
					content: message.content,
					reasoning: message.reasoning,
					model_name: message.modelName,
					is_error: message.isError ?? false,
				});
				return;
			} catch (err) {
				console.error('Failed to save message to Supabase:', err);
			}
		}
		// Fallback: save to localStorage
		updateLocalChat(chatId, (chat) => {
			chat.messages.push(message);
			chat.updatedAt = new Date().toISOString();
		});
	},

	async updateMessage(chatId: string, messageId: string, updates: Partial<Message>) {
		if (useSupabase()) {
			try {
				const dbUpdates: Record<string, unknown> = {};
				if (updates.content !== undefined) dbUpdates.content = updates.content;
				if (updates.reasoning !== undefined) dbUpdates.reasoning = updates.reasoning;
				if (updates.modelName !== undefined) dbUpdates.model_name = updates.modelName;
				if (updates.isError !== undefined) dbUpdates.is_error = updates.isError;
				await supabase.from('messages').update(dbUpdates).eq('id', messageId);
				return;
			} catch {
				// fall through to localStorage
			}
		}
		updateLocalChat(chatId, (chat) => {
			const msg = chat.messages.find((m) => m.id === messageId);
			if (msg) Object.assign(msg, updates);
		});
	},

	async updateChatTitle(chatId: string, title: string) {
		if (useSupabase()) {
			try {
				// Only update `title`. We deliberately do NOT touch `updated_at`
				// here — renaming/regenerating the title is metadata, not new
				// conversation activity, so the chat stays in its current
				// Today/Others section after refresh.
				await supabase.from('chats').update({ title }).eq('id', chatId);
			} catch {
				// fall through to localStorage
			}
		} else {
			updateLocalChat(chatId, (chat) => {
				chat.title = title;
			});
		}
		const inPinned = pinnedChats.find((c) => c.id === chatId);
		if (inPinned) inPinned.title = title;
		const inToday = todayChats.find((c) => c.id === chatId);
		if (inToday) inToday.title = title;
		const inOthers = otherChats.find((c) => c.id === chatId);
		if (inOthers) inOthers.title = title;
		if (activeChat?.id === chatId) activeChat.title = title;
	},

	async deleteChat(chatId: string) {
		if (useSupabase()) {
			try {
				await supabase.from('chats').delete().eq('id', chatId);
			} catch {
				// ignore
			}
		} else {
			const all = loadFromLocalStorage().filter((c) => c.id !== chatId);
			saveToLocalStorage(all);
		}
		pinnedChats = pinnedChats.filter((c) => c.id !== chatId);
		todayChats = todayChats.filter((c) => c.id !== chatId);
		otherChats = otherChats.filter((c) => c.id !== chatId);
		if (activeChat?.id === chatId) {
			activeChat = null;
			messages = [];
		}
	},

	clearActive() {
		activeChat = null;
		messages = [];
	},

	/** Read all localStorage chats (with messages). Used by the post-login sync dialog. */
	getLocalChats(): (Chat & { messages: Message[] })[] {
		return loadFromLocalStorage();
	},

	/**
	 * Migrate localStorage chats to Supabase after sign-in.
	 * @param selectedIds - if provided, only migrate chats whose IDs are in this list.
	 *                     Otherwise migrate all. Either way, localStorage is cleared at the end.
	 */
	async migrateLocalToSupabase(selectedIds?: string[]) {
		if (!useSupabase()) return;
		if (selectedIds && selectedIds.length === 0) return;

		const localChats = loadFromLocalStorage();
		if (localChats.length === 0) return;

		const selectedSet = selectedIds ? new Set(selectedIds) : null;
		const toMigrate = selectedSet ? localChats.filter((c) => selectedSet.has(c.id)) : localChats;

		// Track which local chats migrated cleanly. Only remove those from
		// localStorage at the end — keep the failed ones so the user can retry.
		const succeededLocalIds: string[] = [];
		const failures: { chatId: string; title: string; reason: string }[] = [];

		for (const chat of toMigrate) {
			const { data: newChat, error: chatError } = await supabase
				.from('chats')
				.insert({
					user_id: authStore.user!.id,
					title: chat.title,
					model_id: chat.modelId,
					company_id: chat.companyId,
				})
				.select()
				.single();

			if (chatError || !newChat) {
				failures.push({
					chatId: chat.id,
					title: chat.title,
					reason: chatError?.message ?? 'no row returned',
				});
				continue;
			}

			// Sanitize messages: the migrations table CHECK constrains role to
			// ('user','assistant','system') and content NOT NULL. One bad row
			// fails the whole atomic batch insert — defensive validation here.
			const validMessages = chat.messages
				.filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
				.map((m) => ({
					chat_id: newChat.id,
					role: m.role,
					content: m.content ?? '',
					reasoning: m.reasoning ?? null,
					model_name: m.modelName ?? null,
					is_error: m.isError ?? false,
				}));

			if (validMessages.length > 0) {
				const { data: inserted, error: msgError } = await supabase
					.from('messages')
					.insert(validMessages)
					.select('id');

				if (msgError) {
					// Chat row inserted but messages failed — half-migrated.
					// Roll back the chat row so the user doesn't see an empty chat.
					await supabase.from('chats').delete().eq('id', newChat.id);
					failures.push({
						chatId: chat.id,
						title: chat.title,
						reason: `messages: ${msgError.message}`,
					});
					continue;
				}

				// Sanity-check: did all rows actually land? RLS could silently drop rows.
				if (!inserted || inserted.length !== validMessages.length) {
					await supabase.from('chats').delete().eq('id', newChat.id);
					failures.push({
						chatId: chat.id,
						title: chat.title,
						reason: `messages: expected ${validMessages.length} inserted, got ${inserted?.length ?? 0}`,
					});
					continue;
				}
			}

			succeededLocalIds.push(chat.id);
		}

		// Remove successfully-migrated chats from localStorage; keep failures.
		const all = loadFromLocalStorage();
		const remaining = all.filter((c) => !succeededLocalIds.includes(c.id));
		if (remaining.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			saveToLocalStorage(remaining);
		}

		await chatStore.loadChats();

		if (failures.length > 0) {
			console.error('[migrate] Failed to sync', failures.length, 'chat(s):', failures);
			throw new Error(
				`Failed to sync ${failures.length} of ${toMigrate.length} chats. ` +
					`First error: ${failures[0].reason}. ` +
					`Failed chats remain in localStorage.`
			);
		}
	},
};
