<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import CodeIcon from '@lucide/svelte/icons/code';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
	import SearchIcon from '@lucide/svelte/icons/search';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MessageSquareDashedIcon from '@lucide/svelte/icons/message-square-dashed';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import { goto } from '$app/navigation';
	import { untrack, tick } from 'svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ModelSelector from '$lib/components/model-selector.svelte';
	import ThinkingBlock from '$lib/components/thinking-block.svelte';
	import MarkdownRenderer from '$lib/components/markdown-renderer.svelte';
	import { getDefaultModel, findModel } from '$lib/config/models.js';
	import {
		extractFile,
		isSupportedFile,
		attachmentsToMarkdown,
		looksLikeScannedPdf,
		ATTACHMENT_ACCEPT,
		MAX_TOTAL_BYTES,
		type ExtractedFile,
	} from '$lib/file-extract.js';
	import { commandStore } from '$lib/stores/command.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { chatStore } from '$lib/stores/chats.svelte.js';
	import { themeStore, type Theme } from '$lib/stores/theme.svelte.js';
	import type { Message } from '$lib/types.js';

	let { chatId }: { chatId?: string } = $props();

	$effect(() => {
		const id = chatId;
		// Track authStore.loading so the effect re-runs when auth resolves.
		// On fresh page loads (refresh, new tab, deeplink to /chat/<id>),
		// Supabase's onAuthStateChange fires AFTER this component mounts; if
		// we call loadChat() before that, useSupabase() is false, the chat
		// isn't found, and the .then() below redirects to /.
		const authLoading = authStore.loading;
		// Read activeChat without subscribing — otherwise the effect re-runs
		// when handleSend's createChat() sets activeChat, which would race with
		// the goto() and clobber the in-flight stream's messages array.
		untrack(() => {
			if (!id) {
				if (chatStore.activeChat) chatStore.clearActive();
				return;
			}
			if (authLoading) return; // wait for auth before fetching the chat
			if (chatStore.activeChat?.id === id) return; // already loaded
			chatStore.loadChat(id).then(() => {
				if (chatStore.activeChat?.id !== id) {
					// Not found — silently fall back to /
					goto('/', { replaceState: true });
				}
			});
		});
	});

	const sidebar = useSidebar();

	let tempChatEnabled = $state(false);

	// Switching temp mode in either direction resets the in-memory chat: temp
	// messages are dropped, any active saved chat is cleared, and the user
	// lands on / so the empty-state heading reflects the new mode. This avoids
	// the edge case of mixing temp messages into a saved chat or vice versa.
	function toggleTempChat() {
		tempChatEnabled = !tempChatEnabled;
		chatStore.clearActive();
		goto('/', { replaceState: true });
	}

	const messages = $derived(chatStore.messages);
	let input = $state('');
	let loading = $state(false);
	let textareaEl: HTMLTextAreaElement | null = $state(null);

	// True while we're navigating into a chat whose data hasn't arrived yet:
	// the URL says /chat/<id> but chatStore.activeChat is still the previous
	// chat (or null on a fresh page load). Used to fade+blur the messages
	// pane during the loadChat round-trip — same pattern the sidebar uses
	// for its initial-load skeleton.
	const loadingChat = $derived(!!chatId && chatStore.activeChat?.id !== chatId);

	// Persist the user's model choice across "New Chat" / page reloads via
	// localStorage. Validates on load (model may have been disabled or removed
	// from config since the last visit) and falls back to the default.
	const SELECTED_MODEL_KEY = 'unichat_selected_model';
	function loadStoredModel(): { companyId: string; modelId: string; modelName: string } {
		if (typeof window === 'undefined') return getDefaultModel();
		try {
			const raw = localStorage.getItem(SELECTED_MODEL_KEY);
			if (!raw) return getDefaultModel();
			const stored = JSON.parse(raw) as {
				companyId?: string;
				modelId?: string;
				modelName?: string;
			};
			if (!stored?.companyId || !stored?.modelId) return getDefaultModel();
			const found = findModel(stored.companyId, stored.modelId);
			if (!found || !found.enabled) return getDefaultModel();
			return { companyId: stored.companyId, modelId: stored.modelId, modelName: found.name };
		} catch {
			return getDefaultModel();
		}
	}
	let selectedModel = $state(loadStoredModel());

	$effect(() => {
		// Save whenever the user picks a different model.
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(SELECTED_MODEL_KEY, JSON.stringify(selectedModel));
		} catch {
			// ignore quota / privacy-mode errors
		}
	});

	let messagesEnd: HTMLDivElement | undefined = $state();

	// Poll for server-side response completion: if the last message is an empty
	// assistant message (server is still generating), reload the chat every 3s.
	$effect(() => {
		const last = messages[messages.length - 1];
		const pending = last && last.role === 'assistant' && !last.content && !last.isError && !loading && !chatStore.streaming;
		if (!pending || !chatStore.activeChat?.id) return;

		const interval = setInterval(() => {
			chatStore.loadChat(chatStore.activeChat!.id);
		}, 3000);

		return () => clearInterval(interval);
	});

	// Vision is auto-handled by models that support it (image input is just
	// part of the message content) — no user-facing toggle required.
	//
	// Web search and reasoning effort live in chatStore (not local state) so
	// they survive the first-message `goto('/chat/<id>')` navigation, which
	// unmounts the home-page ChatView and mounts the chat-page one. See the
	// "Cross-navigation flags belong in the store" note in CLAUDE.md.
	const webSearchEnabled = $derived(chatStore.webSearchEnabled);
	const effort = $derived(chatStore.effort);
	// Files staged for the next message. Click the paperclip → picks PDFs.
	// Display-only for now — actual transmission to the provider is a
	// follow-up task (per-provider base64 encoding, content-type handling).
	let attachedFiles = $state<File[]>([]);
	let fileInputEl: HTMLInputElement | undefined = $state();

	// Mobile-only consolidated "Tools" popover. Two views swapped in place:
	// 'main' lists Reasoning / Attach / Search rows, 'reasoning' shows the
	// 4 effort options. Reset to 'main' whenever the popover closes so the
	// next open starts on the row list.
	let toolsOpen = $state(false);
	let toolsView = $state<'main' | 'reasoning'>('main');

	const currentModel = $derived(findModel(selectedModel.companyId, selectedModel.modelId));
	const showEffortPicker = $derived(!!currentModel?.capabilities.thinking);
	const thinkingActive = $derived(effort !== 'fast');
	// Tints the mobile Tools pill when any tool is on, so users can see at a
	// glance that a non-default behavior is active without opening the popover.
	const anyToolActive = $derived(
		webSearchEnabled || attachedFiles.length > 0 || (showEffortPicker && thinkingActive)
	);

	// Guests are gated out of search, file upload, and non-Fast reasoning
	// effort. The buttons still render so the affordance is visible — just
	// locked. Server-side enforcement below in /api/chat as defense-in-depth.
	const isGuest = $derived(!authStore.isAuthenticated);

	// When auth flips off (sign-out, or arriving as a guest with stale
	// localStorage state), clamp the gated toggles back to safe values so
	// the UI and outgoing requests agree.
	$effect(() => {
		if (isGuest) {
			if (chatStore.effort !== 'fast') chatStore.setEffort('fast');
			if (chatStore.webSearchEnabled) chatStore.setWebSearchEnabled(false);
		}
	});

	// Reset toggles on model change
	let prevModelId: string | undefined;
	$effect(() => {
		const id = selectedModel.modelId;
		if (prevModelId !== undefined && id !== prevModelId) {
			// Capability-gated UI hides the effort picker when the new model
			// doesn't think and the Attach button when it doesn't accept
			// files — so we don't need to clear those values eagerly. Effort
			// and webSearchEnabled persist silently in chatStore (and to
			// localStorage); when the user returns to a compatible model the
			// previous preference is still there.
			//
			// Attached files are per-message content, not a preference — they
			// only make sense for the next send and would be stale across a
			// model switch, so we clear them.
			attachedFiles = [];
		}
		prevModelId = id;
	});

	function openFilePicker() {
		fileInputEl?.click();
	}

	function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const picked = Array.from(input.files ?? []);
		// Filter to supported types up-front so the chip area never shows
		// something we can't actually send. Anything skipped surfaces as a
		// brief warning in attachmentError.
		const accepted: File[] = [];
		const rejected: string[] = [];
		for (const f of picked) {
			if (isSupportedFile(f)) accepted.push(f);
			else rejected.push(f.name);
		}
		attachedFiles = [...attachedFiles, ...accepted];
		attachmentError = rejected.length
			? `Skipped unsupported file${rejected.length === 1 ? '' : 's'}: ${rejected.join(', ')}`
			: '';
		input.value = '';
	}

	function removeAttachedFile(index: number) {
		attachedFiles = attachedFiles.filter((_, i) => i !== index);
		attachmentError = '';
	}

	// Surfaces extraction problems (oversize file, PDF parse error,
	// unsupported MIME) under the composer. Cleared on next send / pick.
	let attachmentError = $state('');
	// True while PDF.js / File.text() are running. Drives the small
	// "Reading file(s)…" indicator above the textarea so the user knows
	// why the send button is disabled.
	let isExtracting = $state(false);

	// ── Suggestion prompts ──────────────────────────────
	const suggestions = {
		Explore: [
			'What would happen if the moon disappeared?',
			'Why do we dream and what do they mean?',
			'How did ancient civilizations navigate without GPS?',
			'What are the most bizarre deep sea creatures?',
		],
		Create: [
			'Help me write a cover letter for a tech job',
			'Come up with 10 unique startup ideas',
			'Write an apology email to a client about a delayed project',
			'Create a workout routine for beginners',
		],
		Code: [
			'How do I center a div? Seriously though',
			'Explain async/await like I\'m five',
			'What\'s the difference between SQL and NoSQL?',
			'Help me debug: why is my CSS not applying?',
		],
		Learn: [
			'Break down how compound interest works',
			'Explain the basics of machine learning',
			'How does the internet actually work?',
			'What are logical fallacies and how to spot them?',
		],
	} as const;

	type Category = keyof typeof suggestions;
	let activeCategory = $state<Category>('Explore');

	// Suggestions populate the composer instead of auto-sending so the user
	// can edit the prompt before submitting. After tick() the textarea has
	// the new value bound; setSelectionRange moves the cursor to the end so
	// typing extends the prompt rather than replacing the selection.
	async function useSuggestion(text: string) {
		input = text;
		await tick();
		textareaEl?.focus();
		textareaEl?.setSelectionRange(text.length, text.length);
	}

	$effect(() => {
		if (messages.length) {
			const last = messages[messages.length - 1];
			last?.content; // subscribe to content changes for scroll during streaming
			scrollToBottom();
		}
	});

	function scrollToBottom() {
		messagesEnd?.scrollIntoView({ behavior: 'smooth' });
	}

	let copiedId = $state<string | null>(null);
	function copyMessage(msg: Message) {
		navigator.clipboard.writeText(msg.content).catch(() => {});
		copiedId = msg.id;
		setTimeout(() => { copiedId = null; }, 2000);
	}

	async function handleSend(directText?: string) {
		const text = (directText ?? input).trim();
		if (!text || loading) return;

		// Lock the send button up front — both file extraction and the
		// chat-row insert below are async, and we don't want a double-send
		// re-entry during either.
		loading = true;
		// Clear any stale warning from a prior send. Scoping the clear to
		// "files attached" used to leak the previous send's scanned-PDF /
		// skipped-file message into the next message bubble even when the
		// user wasn't attaching anything new.
		attachmentError = '';

		// Extract attached files BEFORE creating the chat row so a parse
		// error doesn't leave an empty chat hanging around. PDFs go through
		// PDF.js (lazy-loaded), text/code files through File.text(). The
		// extracted text is appended to the user's message as fenced code
		// blocks — universal across every provider, no per-provider native
		// PDF/vision plumbing needed for the common case.
		let extractedAttachments: ExtractedFile[] = [];
		if (attachedFiles.length > 0) {
			// Total-size guard so a user can't pin 250 MB across many files
			// into a single LLM call. Per-file MAX_FILE_BYTES is enforced
			// inside extractFile too — this catches the cumulative case.
			const totalBytes = attachedFiles.reduce((s, f) => s + f.size, 0);
			if (totalBytes > MAX_TOTAL_BYTES) {
				const mb = (totalBytes / 1024 / 1024).toFixed(1);
				const limit = (MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0);
				attachmentError = `Attachments total ${mb} MB; combined limit is ${limit} MB.`;
				loading = false;
				return;
			}

			isExtracting = true;
			// allSettled (not all): if one PDF is corrupt or an unrecognized
			// file slips past the picker filter, salvage the rest instead
			// of dumping the whole batch. Failures surface as a one-line
			// warning while the successes go through. try/finally so an
			// unexpected synchronous throw in extractFile (shouldn't happen,
			// but defensive) still releases the pill.
			let results: PromiseSettledResult<ExtractedFile>[];
			try {
				results = await Promise.allSettled(attachedFiles.map(extractFile));
			} finally {
				isExtracting = false;
			}
			const failed: string[] = [];
			for (let i = 0; i < results.length; i++) {
				const r = results[i];
				if (r.status === 'fulfilled') {
					extractedAttachments.push(r.value);
				} else {
					const reason = r.reason instanceof Error ? r.reason.message : 'Failed to read file';
					failed.push(`${attachedFiles[i].name}: ${reason}`);
				}
			}
			if (failed.length > 0 && extractedAttachments.length === 0) {
				attachmentError = failed.join(' · ');
				loading = false;
				return;
			}
			// PDF.js extracts very little from scanned / image-only PDFs.
			// Surface a soft heads-up so the user knows why the model's
			// answer might be vague — not a hard block.
			const scanned = extractedAttachments.filter(looksLikeScannedPdf);
			const warnings: string[] = [];
			if (failed.length > 0) warnings.push(`Skipped: ${failed.join(', ')}`);
			if (scanned.length > 0) {
				warnings.push(
					`${scanned.map((f) => f.name).join(', ')} looked like scanned PDF${scanned.length === 1 ? '' : 's'} — extracted text may be sparse.`
				);
			}
			attachmentError = warnings.join(' · ');
		}
		// Persisted attachment shape — drops the `language` hint (re-derivable
		// from the filename via attachmentsToMarkdown when replaying), and is
		// what the LLM payload + chip UI will read from now on. Text/PDF
		// content lives here, NOT in message.content, so the user's bubble
		// stays clean while the model still gets the full context.
		const persistedAttachments = extractedAttachments.map((a) => ({
			name: a.name,
			mimeType: a.mimeType,
			pageCount: a.pageCount,
			text: a.text,
		}));

		// Temp mode: skip every persistence step. Messages live only in
		// chatStore.messages (in-memory), no chat row created, no sidebar
		// entry, no DB write, no localStorage. Refresh clears everything.
		// Create chat on first message (skipped in temp mode).
		let currentChatId: string | undefined;
		let isNewChat = false;
		if (!tempChatEnabled) {
			currentChatId = chatStore.activeChat?.id;
			if (!currentChatId) {
				try {
					currentChatId = await chatStore.createChat(selectedModel.modelId, selectedModel.companyId);
					isNewChat = true;
				} catch (err) {
					console.error('Failed to create chat:', err);
					return;
				}
			}
		}

		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			...(persistedAttachments.length ? { attachments: persistedAttachments } : {}),
		};
		chatStore.pushMessage(userMsg);
		input = '';
		// Attachments are stored on userMsg.attachments above and folded
		// back into the request body at fetch time (see the messages.map
		// inside the /api/chat fetch below). Clear the staging area so the
		// chips disappear and the next message starts fresh. We deliberately
		// KEEP attachmentError set here — soft warnings
		// (scanned PDF, partial extraction failures) need to remain visible
		// after the send so the user can read them. They get cleared at the
		// start of the next handleSend (when extraction begins) or when the
		// user picks/removes a file.
		attachedFiles = [];

		chatStore.pushMessage({
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			modelName: selectedModel.modelName,
		});
		const assistantMsg = chatStore.lastMessage()!;

		if (isNewChat && currentChatId) {
			goto(`/chat/${currentChatId}`, { replaceState: true, noScroll: true });
		}

		// Persist user message (fire-and-forget). Skipped in temp mode.
		if (!tempChatEnabled && currentChatId) {
			chatStore.addMessage(currentChatId, userMsg);

			// Auto-title from first user message
			if (messages.filter((m) => m.role === 'user').length === 1) {
				const title = text.length > 50 ? text.slice(0, 50) + '...' : text;
				chatStore.updateChatTitle(currentChatId, title);
			}
		}

		chatStore.setStreaming(true);
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			const token = authStore.getAccessToken();
			if (token) headers['Authorization'] = `Bearer ${token}`;

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					companyId: selectedModel.companyId,
					modelId: selectedModel.modelId,
					messages: messages
						.filter((m) => m.id !== assistantMsg.id && !m.isError)
						.map((m) => ({
							role: m.role,
							// Attachments are stored separately on the Message so
							// the bubble can render clean; fold them back into a
							// single content string for the LLM here. This keeps
							// every provider on the existing string-content shape.
							content: m.attachments?.length
								? `${m.content}\n\n${attachmentsToMarkdown(m.attachments)}`
								: m.content,
						})),
					...(showEffortPicker && thinkingActive && { thinking: true, effort }),
					...(webSearchEnabled && { webSearch: true }),
					// In temp mode we omit chatId/messageId so the server-side
					// tee in /api/chat skips the DB save (its guard requires both).
					...(!tempChatEnabled &&
						authStore.isAuthenticated &&
						currentChatId && { chatId: currentChatId, messageId: assistantMsg.id }),
				}),
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ error: 'Request failed' }));
				assistantMsg.content = err.error || 'Something went wrong.';
				assistantMsg.isError = true;
				loading = false;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				assistantMsg.content = 'No response received.';
				loading = false;
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6).trim();
					if (data === '[DONE]') break;

					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta;
						// Different providers name the reasoning field differently:
						//   • Our Gemini transform emits `reasoning_content`
						//   • Groq's GPT-OSS reasoning models emit `reasoning`
						//   • OpenRouter normalizes thinking models to `reasoning`
						// Accept either so thinking displays across all of them.
						const reasoningChunk: unknown =
							delta?.reasoning_content ?? delta?.reasoning;
						if (typeof reasoningChunk === 'string' && reasoningChunk.length > 0) {
							assistantMsg.reasoning =
								(assistantMsg.reasoning ?? '') + reasoningChunk;
							assistantMsg.isThinking = true;
						}
						if (delta?.content) {
							assistantMsg.isThinking = false;
							assistantMsg.content += delta.content;
						}
					} catch {
						// Skip unparseable chunks
					}
				}
			}

			assistantMsg.isThinking = false;
			if (!assistantMsg.content) {
				assistantMsg.content = 'No response generated. Check your API keys.';
				assistantMsg.isError = true;
			}
		} catch (err) {
			assistantMsg.isThinking = false;
			assistantMsg.content = `Error: ${err instanceof Error ? err.message : 'Connection failed'}`;
			assistantMsg.isError = true;
		} finally {
			loading = false;
			chatStore.setStreaming(false);
			// Server handles assistant message persistence for authenticated users (via tee).
			// Only save client-side for guests. Skipped entirely in temp mode.
			if (
				!tempChatEnabled &&
				currentChatId &&
				assistantMsg.content &&
				!authStore.isAuthenticated
			) {
				chatStore.addMessage(currentChatId, {
					id: assistantMsg.id,
					role: assistantMsg.role,
					content: assistantMsg.content,
					reasoning: assistantMsg.reasoning,
					modelName: assistantMsg.modelName,
					isError: assistantMsg.isError,
				});
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

<div class="flex h-dvh flex-col sm:h-svh">
	<!-- Floating toolbar (slides in from left when sidebar hides). On mobile
	     it must always be visible — the desktop sidebar is collapsed off-canvas
	     and the only way to open the mobile sheet is via this trigger. -->
	{#if !sidebar.open || sidebar.isMobile}
		<div class="floating-toolbar absolute left-3 top-4 z-20 sm:top-3" data-onboarding="floating-toolbar-left">
			<div class="flex items-center gap-0.5 rounded-xl bg-sidebar p-1 shadow-md ring-1 ring-sidebar-border">
				<button
					class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]"
					onclick={() => sidebar.toggle()}
					title="Open sidebar"
				>
					<PanelLeftIcon class="size-4" />
				</button>
				<button
					class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]"
					onclick={() => commandStore.open = true}
					title="Search chats"
				>
					<SearchIcon class="size-4" />
				</button>
				<button
					class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]"
					title="New chat"
					onclick={() => goto('/')}
				>
					<PlusIcon class="size-4" />
				</button>
			</div>
		</div>
	{/if}

	<!-- Right floating toolbar -->
	<div class="floating-toolbar-right absolute right-3 top-4 z-20 sm:top-3">
		<div class="flex items-center gap-0.5 rounded-xl bg-sidebar p-1 shadow-md ring-1 ring-sidebar-border">
			<!-- Temporary chat toggle -->
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex size-9 items-center justify-center rounded-lg transition-all active:scale-[0.97]
								{tempChatEnabled
									? 'bg-primary/15 text-primary'
									: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}"
							onclick={toggleTempChat}
							aria-label="Toggle temporary chat"
							aria-pressed={tempChatEnabled}
						>
							<MessageSquareDashedIcon class="size-4" />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>
					<p class="font-semibold">Temporary chat</p>
					<p class="text-xs text-muted-foreground">Won't be saved. Refresh clears it.</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<!-- Settings popover -->
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]"
							title="Settings"
							data-onboarding="settings-button"
						>
							<SettingsIcon class="size-4" />
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content align="end" side="bottom" class="w-56 p-3" sideOffset={8}>
					<!-- Theme selector -->
					<div class="space-y-3" data-onboarding="theme-toggles">
						<p class="text-sm font-semibold">Theme</p>
						<ToggleGroup.Root
							type="single"
							value={themeStore.value}
							onValueChange={(v) => { if (v) themeStore.set(v as Theme); }}
							class="w-full"
						>
							<ToggleGroup.Item value="light" class="flex-1 gap-1.5 text-xs">
								<SunIcon class="size-3.5" />
								Light
							</ToggleGroup.Item>
							<ToggleGroup.Item value="dark" class="flex-1 gap-1.5 text-xs">
								<MoonIcon class="size-3.5" />
								Dark
							</ToggleGroup.Item>
							<ToggleGroup.Item value="auto" class="flex-1 gap-1.5 text-xs">
								<MonitorIcon class="size-3.5" />
								Auto
							</ToggleGroup.Item>
						</ToggleGroup.Root>

						<Separator />

						<!-- Settings link -->
						<button
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
							onclick={() => goto('/settings')}
						>
							<SettingsIcon class="size-4" />
							Settings
						</button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	</div>

	<!-- Messages. Blur+fade while loadingChat so the user sees the same
	     "thinking..." treatment the sidebar uses, instead of a flash of the
	     previous chat or an empty state, while loadChat() resolves. -->
	<div
		class="flex-1 overflow-y-auto transition-[filter,opacity] duration-500 ease-out"
		class:blur-md={loadingChat}
		class:opacity-60={loadingChat}
	>
		{#if messages.length === 0}
			<div class="relative flex h-full items-start justify-center px-2 pt-20 pb-32 sm:items-center sm:px-0 sm:pt-0">
				<!-- "Press Enter to start your chat" hint. Absolute-positioned over
				     the same area so it cross-fades with the suggestion block when
				     the composer has text. The kbd has a continuous bob animation
				     to subtly draw the eye toward the action. -->
				<div
					class="pointer-events-none absolute inset-0 flex items-center justify-center px-4 transition-opacity duration-300 ease-out {input.trim()
						? 'opacity-100'
						: 'opacity-0'}"
				>
					<!-- Two-line stack on mobile (Press [Enter] / to start your chat),
					     single-line on sm:+ where horizontal space allows. Sizes bump
					     up from text-lg → text-2xl on desktop, kbd scales to match. -->
					<div
						class="flex flex-col items-center gap-2 text-center text-lg font-medium text-muted-foreground sm:flex-row sm:gap-2.5 sm:text-2xl"
					>
						<span class="flex items-center gap-2 sm:gap-2.5">
							<span>Press</span>
							<kbd
								class="press-enter-kbd inline-flex h-8 min-w-10 items-center justify-center rounded-md border border-primary bg-primary px-2.5 text-sm font-semibold text-primary-foreground sm:h-10 sm:min-w-12 sm:px-3 sm:text-base"
							>
								Enter
							</kbd>
						</span>
						<span>to start your chat</span>
					</div>
				</div>

				<!-- Empty-state intro fades when the composer has text. Re-fades-in
				     when the user clears the composer back to empty. pointer-events
				     suppression while faded prevents stray clicks on suggestions
				     mid-fade. -->
				<div
					class="w-full max-w-2xl px-4 transition-opacity duration-300 ease-out {input.trim()
						? 'pointer-events-none opacity-0'
						: 'opacity-100'}"
				>
					{#if tempChatEnabled}
						<h2 class="flex items-center gap-2 text-2xl font-semibold sm:gap-2.5 sm:text-3xl">
							<MessageSquareDashedIcon class="size-6 text-muted-foreground sm:size-7" />
							Temporary chat
						</h2>
						<p class="mt-2 text-sm text-muted-foreground">
							This conversation won't be saved anywhere. Refreshing the page will clear it.
						</p>
					{:else}
						<h2 class="text-2xl font-semibold sm:text-3xl">How can I help you?</h2>
					{/if}

					<!-- Category tabs -->
					<div class="mt-6 flex flex-wrap items-center gap-1.5">
						{#each Object.keys(suggestions) as category}
							{@const isActive = activeCategory === category}
							<button
								class="suggestion-pill flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-all
									{isActive
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'text-muted-foreground hover:bg-primary/15 hover:text-foreground hover:shadow-sm'}"
								onclick={() => activeCategory = category as Category}
							>
								{#if category === 'Explore'}
									<CompassIcon class="size-4" />
								{:else if category === 'Create'}
									<SparklesIcon class="size-4" />
								{:else if category === 'Code'}
									<CodeIcon class="size-4" />
								{:else}
									<GraduationCapIcon class="size-4" />
								{/if}
								{category}
							</button>
						{/each}
					</div>

					<!-- Suggestion list -->
					<div class="mt-5">
						{#each suggestions[activeCategory] as prompt}
							<button
								class="suggestion-item flex w-full items-center border-b border-border px-1 py-3 text-left text-sm text-muted-foreground transition-all hover:text-foreground sm:py-3.5 sm:text-base"
								onclick={() => useSuggestion(prompt)}
							>
								{prompt}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<div class="mx-auto max-w-3xl space-y-6 px-4 pt-20 pb-8">
				{#each messages as message, idx}
					{#if message.role === 'user'}
						<div class="group flex flex-col items-end">
							<div class="max-w-[85%] rounded-2xl bg-muted/60 px-4 py-2.5">
								<p class="whitespace-pre-wrap text-base">{message.content}</p>
							</div>
							<!-- Attachments rendered as compact chips BELOW the bubble.
							     The full extracted text only goes to the LLM (combined
							     into `content` at request time), so the user sees a
							     clean message + filenames here, not 50 KB of fenced PDF
							     text in their own bubble. -->
							{#if message.attachments?.length}
								<div class="mt-1.5 flex max-w-[85%] flex-wrap justify-end gap-1.5">
									{#each message.attachments as a, i (`${i}:${a.name}`)}
										<div
											class="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground"
										>
											<PaperclipIcon class="size-3 shrink-0" />
											<span class="max-w-48 truncate text-foreground">{a.name}</span>
											{#if a.pageCount}
												<span class="shrink-0">·&nbsp;{a.pageCount}p</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
							<div class="mt-2 flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
								<button
									class="msg-action flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
									onclick={() => copyMessage(message)}
								>
									{#if copiedId === message.id}
										<CheckIcon class="size-4" />
										<span>Copied</span>
									{:else}
										<CopyIcon class="size-4" />
										<span>Copy</span>
									{/if}
								</button>
							</div>
						</div>
					{:else}
						<!-- Read streaming state from the store, NOT local `loading`.
						     The first message in a new chat triggers goto('/chat/<id>'),
						     which unmounts this component instance; the fetch keeps
						     running in the old instance and fills assistantMsg.content,
						     but the new instance's local `loading` is false. The store
						     value persists across the navigation so the indicator
						     survives the remount. -->
						{@const isStreamingMsg = chatStore.streaming && idx === messages.length - 1}
						<div
							class="assistant-msg group -mx-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/40"
							class:streaming-active={isStreamingMsg}
						>
							{#if message.reasoning}
								<ThinkingBlock reasoning={message.reasoning} isThinking={message.isThinking ?? false} />
							{/if}
							{#if !message.content && !message.reasoning}
								<div class="flex items-center gap-1 py-1">
									<span class="typing-dot size-1.5 rounded-full bg-muted-foreground/60"></span>
									<span class="typing-dot size-1.5 rounded-full bg-muted-foreground/60" style="animation-delay: 0.15s"></span>
									<span class="typing-dot size-1.5 rounded-full bg-muted-foreground/60" style="animation-delay: 0.3s"></span>
								</div>
							{:else}
								<MarkdownRenderer
									content={message.content}
									streaming={isStreamingMsg}
								/>
							{/if}
							<!-- Static Svelte-rendered streaming pill. Lives OUTSIDE the
							     markdown {@html} block, so the throttled re-renders
							     during streaming don't replace this element — the spin
							     animation runs continuously instead of resetting every
							     100ms. Visible only while the store reports streaming
							     AND this is the in-flight (last) assistant message. -->
							{#if isStreamingMsg}
								<div class="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20">
									<span class="streaming-spinner" aria-hidden="true"></span>
									<span>Generating</span>
								</div>
							{/if}
							{#if message.content}
								<div class="mt-4 flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
									<button
										class="msg-action flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
										onclick={() => copyMessage(message)}
									>
										{#if copiedId === message.id}
											<CheckIcon class="size-4" />
											<span>Copied</span>
										{:else}
											<CopyIcon class="size-4" />
											<span>Copy</span>
										{/if}
									</button>
									{#if message.modelName}
										<span class="flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-sm font-medium text-muted-foreground">{message.modelName}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				{/each}
				<div bind:this={messagesEnd}></div>
			</div>
		{/if}
	</div>

	<!-- Composer -->
	<div class="px-3 pb-4 sm:px-6 sm:pb-6">
		<div class="mx-auto max-w-3xl rounded-2xl p-2 sm:p-3" style="background-color: var(--composer-bg);">
			<!-- Hidden file picker. Triggered by the "Attach" button below.
			     Accepts PDFs plus a wide allowlist of text/code/data extensions —
			     all extracted client-side via file-extract.ts and embedded as
			     markdown into the user's message. The accept string is built
			     from the same allowlist (TEXT_EXTENSIONS in file-extract.ts) so
			     the picker filter and the runtime check stay in sync. -->
			<input
				type="file"
				accept={ATTACHMENT_ACCEPT}
				multiple
				class="hidden"
				bind:this={fileInputEl}
				onchange={handleFileSelect}
			/>

			<!-- Staged file attachments. Files are extracted to text in
			     handleSend (PDFs via PDF.js, code/text via File.text()) and
			     appended to the user's message before it goes to the LLM.
			     Universal across providers — no per-provider plumbing needed. -->
			{#if attachedFiles.length > 0}
				<div class="mb-2 flex flex-wrap gap-1.5 px-1">
					{#each attachedFiles as f, i (i + ':' + f.name)}
						<div class="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
							<PaperclipIcon class="size-3 text-muted-foreground" />
							<span class="max-w-40 truncate">{f.name}</span>
							<button
								class="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
								onclick={() => removeAttachedFile(i)}
								disabled={isExtracting || loading}
								aria-label={`Remove ${f.name}`}
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
			{#if isExtracting}
				<div
					class="mb-2 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
					role="status"
					aria-live="polite"
				>
					<span class="streaming-spinner" aria-hidden="true"></span>
					Reading file{attachedFiles.length === 1 ? '' : 's'}…
				</div>
			{:else if attachmentError}
				<div
					class="mb-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
					role="alert"
					aria-live="assertive"
				>
					{attachmentError}
				</div>
			{/if}

			<!-- Textarea -->
			<Textarea
				bind:ref={textareaEl}
				bind:value={input}
				placeholder="Send a message..."
				class="max-h-50 min-h-25 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0 md:text-base"
				rows={3}
				onkeydown={handleKeydown}
				data-onboarding="composer"
			/>

			<!-- Bottom row: model selector left, capability toggles right, send far right -->
			<div class="mt-3 flex items-center gap-2">
				<ModelSelector bind:selected={selectedModel} />

				<div class="flex flex-1 items-center justify-end gap-1.5">
					<!-- Mobile-only consolidated Tools popover. Replaces the icon-only
					     Reasoning / Attach / Search trio at <sm: where unlabeled icons
					     are illegible. Two views swap in place: 'main' lists the tools,
					     'reasoning' shows the 4 effort options. -->
					<Popover.Root
						open={toolsOpen}
						onOpenChange={(o) => {
							toolsOpen = o;
							if (!o) toolsView = 'main';
						}}
					>
						<Popover.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all sm:hidden
										{anyToolActive
											? 'bg-primary/15 text-primary ring-1 ring-primary/30'
											: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
									aria-label="Tools"
									aria-expanded={toolsOpen}
									data-onboarding="tools-mobile"
								>
									Tools
									<ChevronDownIcon
										class="size-4 transition-transform duration-200 ease-out {toolsOpen ? 'rotate-0' : 'rotate-180'}"
									/>
								</button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content side="top" align="end" sideOffset={8} class="w-72 p-1.5">
							{#if toolsView === 'main'}
								<div class="space-y-0.5">
									{#if showEffortPicker}
										<button
											class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
											onclick={() => (toolsView = 'reasoning')}
										>
											<BrainIcon class="size-4 shrink-0 {thinkingActive ? 'text-violet-600' : 'text-muted-foreground'}" />
											<div class="flex flex-1 flex-col">
												<span class="text-sm font-semibold">Reasoning effort</span>
												<span class="text-xs text-muted-foreground">How hard the model thinks</span>
											</div>
											<span class="text-xs font-semibold capitalize text-muted-foreground">{effort}</span>
										</button>
									{/if}
									<!-- Attach is now universal: PDFs and text/code files extract
									     to plain text client-side and embed into the message at
									     send time, so every model can ingest them. The old
									     capabilities.files gate is gone. Image attachments
									     (V2) will re-introduce a vision-capability gate when
									     they land. -->
									<button
										class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors
											{isGuest ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted'}"
										onclick={() => {
											if (isGuest) return;
											toolsOpen = false;
											openFilePicker();
										}}
										disabled={isGuest}
									>
										{#if isGuest}
											<LockIcon class="size-4 shrink-0 text-muted-foreground" />
										{:else}
											<PaperclipIcon class="size-4 shrink-0 {attachedFiles.length > 0 ? 'text-pink-600' : 'text-muted-foreground'}" />
										{/if}
										<div class="flex flex-1 flex-col">
											<span class="text-sm font-semibold">Attach file</span>
											<span class="text-xs text-muted-foreground">
												{isGuest ? 'Sign in to attach files' : 'PDF or text / code'}
											</span>
										</div>
										{#if !isGuest && attachedFiles.length > 0}
											<span class="text-xs font-semibold text-pink-600">{attachedFiles.length}</span>
										{/if}
									</button>
									<button
										class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors
											{isGuest ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted'}"
										onclick={() => {
											if (isGuest) return;
											chatStore.setWebSearchEnabled(!chatStore.webSearchEnabled);
										}}
										disabled={isGuest}
									>
										{#if isGuest}
											<LockIcon class="size-4 shrink-0 text-muted-foreground" />
										{:else}
											<GlobeIcon class="size-4 shrink-0 {webSearchEnabled ? 'text-teal-600' : 'text-muted-foreground'}" />
										{/if}
										<div class="flex flex-1 flex-col">
											<span class="text-sm font-semibold">Web search</span>
											<span class="text-xs text-muted-foreground">
												{isGuest ? 'Sign in to use web search' : 'Search the web for current info'}
											</span>
										</div>
										{#if !isGuest}
											<span
												class="rounded-full px-2 py-0.5 text-xs font-semibold {webSearchEnabled
													? 'bg-teal-500/15 text-teal-600'
													: 'text-muted-foreground'}"
											>
												{webSearchEnabled ? 'On' : 'Off'}
											</span>
										{/if}
									</button>
								</div>
							{:else}
								<div class="space-y-0.5">
									<div class="flex items-center gap-1 px-1 py-1">
										<button
											class="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
											onclick={() => (toolsView = 'main')}
											aria-label="Back"
										>
											<ChevronLeftIcon class="size-4" />
										</button>
										<span class="flex-1 text-sm font-semibold">Reasoning effort</span>
									</div>
									{#each ['fast', 'low', 'medium', 'high'] as level (level)}
										{@const locked = isGuest && level !== 'fast'}
										{@const isCurrent = effort === level}
										<button
											class="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors
												{locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted'}"
											onclick={() => {
												if (locked) return;
												if (level === 'fast' || level === 'low' || level === 'medium' || level === 'high') {
													chatStore.setEffort(level);
												}
												toolsView = 'main';
											}}
											disabled={locked}
										>
											<span class="flex items-center gap-2">
												<span class="flex size-4 items-center justify-center">
													{#if isCurrent}
														<CheckIcon class="size-4 text-primary" />
													{/if}
												</span>
												<span class="font-semibold capitalize">{level}</span>
											</span>
											{#if locked}
												<LockIcon class="size-3 text-muted-foreground" />
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</Popover.Content>
					</Popover.Root>

					<!-- Desktop: inline capability toggles. Hidden at <sm: where the
					     consolidated Tools popover above takes over. -->
					<div class="hidden items-center gap-1.5 sm:flex" data-onboarding="capability-toggles">
						{#if showEffortPicker}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
												{thinkingActive
													? 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30'
													: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
											title="Reasoning effort"
										>
											<BrainIcon class="size-4" />
											<span class="capitalize">{effort}</span>
											<ChevronDownIcon class="size-3" />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-36">
									<DropdownMenu.RadioGroup
										value={effort}
										onValueChange={(v) => {
											if (isGuest) return;
											if (v === 'fast' || v === 'low' || v === 'medium' || v === 'high') {
												chatStore.setEffort(v);
											}
										}}
									>
										<DropdownMenu.RadioItem value="fast">Fast</DropdownMenu.RadioItem>
										<DropdownMenu.RadioItem value="low" disabled={isGuest}>
											<span class="flex w-full items-center justify-between">
												<span>Low</span>
												{#if isGuest}
													<LockIcon class="size-3 text-muted-foreground" />
												{/if}
											</span>
										</DropdownMenu.RadioItem>
										<DropdownMenu.RadioItem value="medium" disabled={isGuest}>
											<span class="flex w-full items-center justify-between">
												<span>Medium</span>
												{#if isGuest}
													<LockIcon class="size-3 text-muted-foreground" />
												{/if}
											</span>
										</DropdownMenu.RadioItem>
										<DropdownMenu.RadioItem value="high" disabled={isGuest}>
											<span class="flex w-full items-center justify-between">
												<span>High</span>
												{#if isGuest}
													<LockIcon class="size-3 text-muted-foreground" />
												{/if}
											</span>
										</DropdownMenu.RadioItem>
									</DropdownMenu.RadioGroup>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
						<!-- Attach a PDF or text / code file. Universal across every
						     model — the file is extracted to plain text client-side
						     and folded into the message payload at send time, so the
						     old capabilities.files gate is intentionally absent. The
						     vision flag will gate IMAGE attachments when those land
						     (V2). -->
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{isGuest
									? 'cursor-not-allowed text-muted-foreground/50'
									: attachedFiles.length > 0
										? 'bg-pink-500/15 text-pink-600 ring-1 ring-pink-500/30'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'}
								disabled:cursor-not-allowed disabled:opacity-60"
							onclick={isGuest ? undefined : openFilePicker}
							disabled={isGuest || isExtracting}
							title={isGuest
								? 'Sign in to attach files'
								: isExtracting
									? 'Reading attached files…'
									: 'Attach PDF or text / code'}
						>
							{#if isGuest}
								<LockIcon class="size-4" />
							{:else}
								<PaperclipIcon class="size-4" />
							{/if}
							<span>
								Attach{!isGuest && attachedFiles.length > 0 ? ` (${attachedFiles.length})` : ''}
							</span>
						</button>
						<!-- Web Search is always available for signed-in users. Native-
						     search models (Compound, Sonar) handle it themselves; for
						     others, a custom search-tool wrapper will inject results
						     into the request — wired in a follow-up. Guests see the
						     button locked. -->
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{isGuest
									? 'cursor-not-allowed text-muted-foreground/50'
									: webSearchEnabled
										? 'bg-teal-500/15 text-teal-600 ring-1 ring-teal-500/30'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={isGuest ? undefined : () => chatStore.setWebSearchEnabled(!chatStore.webSearchEnabled)}
							disabled={isGuest}
							title={isGuest ? 'Sign in to use web search' : 'Toggle web search'}
						>
							{#if isGuest}
								<LockIcon class="size-4" />
							{:else}
								<GlobeIcon class="size-4" />
							{/if}
							<span>Search</span>
						</button>
					</div>
				</div>

				<Button
					size="icon"
					class="size-11 shrink-0 rounded-xl"
					onclick={() => handleSend()}
					disabled={!input.trim() || loading}
				>
					<ArrowUpIcon class="size-5" />
				</Button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Streaming "Generating" spinner — uses the global `md-spin` keyframe
	 * defined in app.css. Element is Svelte-managed, lives outside the
	 * markdown {@html} block, so it isn't replaced on every chunk and the
	 * animation runs continuously without resetting. */
	.streaming-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 9999px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: md-spin 0.7s linear infinite;
	}

	.capability-toggle {
		transform: scale(1);
	}
	.capability-toggle:hover {
		transform: scale(1.05);
	}
	.capability-toggle:active {
		transform: scale(0.97);
	}
	.msg-action {
		transform: scale(1);
	}
	.msg-action:hover {
		transform: scale(1.05);
	}
	.msg-action:active {
		transform: scale(0.97);
	}
	.typing-dot {
		animation: typing-bounce 1.2s ease-in-out infinite;
	}
	@keyframes typing-bounce {
		0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
		30% { opacity: 1; transform: translateY(-3px); }
	}
	.suggestion-pill {
		transform: scale(1);
	}
	.suggestion-pill:hover {
		transform: scale(1.05);
	}
	.suggestion-pill:active {
		transform: scale(0.97);
	}
	.suggestion-item:hover {
		padding-left: 0.75rem;
	}
	.floating-toolbar {
		animation: slide-in-left 0.2s ease-out;
	}
	@keyframes slide-in-left {
		0% { opacity: 0; transform: translateX(-100%); }
		100% { opacity: 1; transform: translateX(0); }
	}
	.floating-toolbar-right {
		animation: slide-in-right 0.2s ease-out;
	}
	@keyframes slide-in-right {
		0% { opacity: 0; transform: translateX(100%); }
		100% { opacity: 1; transform: translateX(0); }
	}
	.press-enter-kbd {
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
		animation: press-enter-bob 1.8s ease-in-out infinite;
	}
	@keyframes press-enter-bob {
		0%, 100% {
			transform: translateY(0);
			box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
		}
		50% {
			transform: translateY(-3px);
			box-shadow: 0 6px 14px rgb(0 0 0 / 0.08);
		}
	}
</style>
