import { supabase } from '$lib/supabase.js';
import { authStore } from '$lib/stores/auth.svelte.js';
import type { Chat, Message } from '$lib/types.js';

const STORAGE_KEY = 'unichat_chats';
const MAX_LOCAL_CHATS = 50;

let chats = $state<Chat[]>([]);
let activeChat = $state<Chat | null>(null);
let messages = $state<Message[]>([]);
// True while a client-side fetch is actively streaming a response.
// Lives in the store (not a component) so it survives the new-chat → /chat/<id>
// navigation; the polling $effect uses it to avoid clobbering an in-flight stream.
let streaming = $state(false);

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
	get chats() {
		return chats;
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

	/** Push a message to the current array and trigger reactivity. */
	pushMessage(msg: Message) {
		messages = [...messages, msg];
	},

	/** Get the last message reference for streaming mutations. */
	lastMessage(): Message | undefined {
		return messages[messages.length - 1];
	},

	async loadChats() {
		if (useSupabase()) {
			try {
				const { data, error } = await supabase
					.from('chats')
					.select('*')
					.order('updated_at', { ascending: false })
					.limit(50);
				if (error) throw error;
				chats = data?.map(mapChatRow) ?? [];
				return;
			} catch (err) {
				markSupabaseUnavailable(err);
			}
		}
		{
			const local = loadFromLocalStorage();
			chats = local.map(({ messages: _, ...chat }) => chat);
		}
	},

	async createChat(
		modelId?: string,
		companyId?: string
	): Promise<string> {
		const now = new Date().toISOString();

		if (useSupabase()) {
			try {
				const { data, error } = await supabase
					.from('chats')
					.insert({
						user_id: authStore.user!.id,
						title: 'New Chat',
						model_id: modelId,
						company_id: companyId,
					})
					.select()
					.single();

				if (error || !data) throw error;
				const chat = mapChatRow(data);
				chats = [chat, ...chats];
				activeChat = chat;
				return chat.id;
			} catch (err) {
				markSupabaseUnavailable(err);
			}
		}

		{
			const chat: Chat = {
				id: crypto.randomUUID(),
				title: 'New Chat',
				modelId,
				companyId,
				createdAt: now,
				updatedAt: now,
			};
			const all = loadFromLocalStorage();
			all.unshift({ ...chat, messages: [] });
			saveToLocalStorage(all);
			chats = [chat, ...chats];
			activeChat = chat;
			return chat.id;
		}
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
				await supabase
					.from('chats')
					.update({ title, updated_at: new Date().toISOString() })
					.eq('id', chatId);
			} catch {
				// fall through to localStorage
			}
		} else {
			updateLocalChat(chatId, (chat) => {
				chat.title = title;
			});
		}
		const chat = chats.find((c) => c.id === chatId);
		if (chat) chat.title = title;
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
		chats = chats.filter((c) => c.id !== chatId);
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
