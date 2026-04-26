<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import BrainIcon from '@lucide/svelte/icons/brain';
	import EyeIcon from '@lucide/svelte/icons/eye';
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
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ModelSelector from '$lib/components/model-selector.svelte';
	import ThinkingBlock from '$lib/components/thinking-block.svelte';
	import MarkdownRenderer from '$lib/components/markdown-renderer.svelte';
	import { getDefaultModel, findModel } from '$lib/config/models.js';
	import { commandStore } from '$lib/stores/command.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { chatStore } from '$lib/stores/chats.svelte.js';
	import type { Message } from '$lib/types.js';

	const sidebar = useSidebar();

	// Theme
	type Theme = 'light' | 'dark' | 'auto';
	let theme = $state<Theme>('auto');
	let tempChatEnabled = $state(false);

	function applyTheme(t: Theme) {
		theme = t;
		if (t === 'dark') {
			document.documentElement.classList.add('dark');
		} else if (t === 'light') {
			document.documentElement.classList.remove('dark');
		} else {
			// Auto: follow system preference
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.classList.toggle('dark', prefersDark);
		}
	}

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let selectedModel = $state(getDefaultModel());
	let messagesEnd: HTMLDivElement | undefined = $state();

	// Sync local messages when store loads a chat or clears
	$effect(() => {
		messages = chatStore.messages;
	});

	// Poll for server-side response completion: if the last message is an empty
	// assistant message (server is still generating), reload the chat every 3s.
	$effect(() => {
		const last = messages[messages.length - 1];
		const pending = last && last.role === 'assistant' && !last.content && !last.isError && !loading;
		if (!pending || !chatStore.activeChat?.id) return;

		const interval = setInterval(() => {
			chatStore.loadChat(chatStore.activeChat!.id);
		}, 3000);

		return () => clearInterval(interval);
	});

	let thinkingEnabled = $state(false);
	let visionEnabled = $state(false);
	let filesEnabled = $state(false);
	let webSearchEnabled = $state(false);

	const currentModel = $derived(findModel(selectedModel.companyId, selectedModel.modelId));

	// Reset toggles on model change
	let prevModelId: string | undefined;
	$effect(() => {
		const id = selectedModel.modelId;
		if (prevModelId !== undefined && id !== prevModelId) {
			thinkingEnabled = false;
			visionEnabled = false;
			filesEnabled = false;
			webSearchEnabled = false;
		}
		prevModelId = id;
	});

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

	function useSuggestion(text: string) {
		handleSend(text);
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

		// Create chat on first message
		let chatId = chatStore.activeChat?.id;
		if (!chatId) {
			try {
				chatId = await chatStore.createChat(selectedModel.modelId, selectedModel.companyId);
			} catch (err) {
				console.error('Failed to create chat:', err);
				return;
			}
		}

		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
		};
		messages.push(userMsg);
		input = '';
		loading = true;

		messages.push({
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			modelName: selectedModel.modelName,
		});
		const assistantMsg = messages[messages.length - 1];

		// Persist user message (fire-and-forget)
		chatStore.addMessage(chatId, userMsg);

		// Auto-title from first user message
		if (messages.filter((m) => m.role === 'user').length === 1) {
			const title = text.length > 50 ? text.slice(0, 50) + '...' : text;
			chatStore.updateChatTitle(chatId, title);
		}

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
						.map((m) => ({ role: m.role, content: m.content })),
					...(thinkingEnabled && { thinking: true }),
					...(authStore.isAuthenticated && { chatId, messageId: assistantMsg.id }),
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
						if (delta?.reasoning_content) {
							assistantMsg.reasoning = (assistantMsg.reasoning ?? '') + delta.reasoning_content;
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
			// Server handles assistant message persistence for authenticated users (via tee).
			// Only save client-side for guests.
			if (chatId && assistantMsg.content && !authStore.isAuthenticated) {
				chatStore.addMessage(chatId, {
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

<div class="flex h-svh flex-col">
	<!-- Floating toolbar (slides in from left when sidebar hides) -->
	{#if !sidebar.open}
		<div class="floating-toolbar absolute left-3 top-3 z-20">
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
					onclick={() => chatStore.clearActive()}
				>
					<PlusIcon class="size-4" />
				</button>
			</div>
		</div>
	{/if}

	<!-- Right floating toolbar -->
	<div class="floating-toolbar-right absolute right-3 top-3 z-20">
		<div class="flex items-center gap-0.5 rounded-xl bg-sidebar p-1 shadow-md ring-1 ring-sidebar-border">
			<!-- Temporary chat toggle -->
			<button
				class="flex size-9 items-center justify-center rounded-lg transition-all active:scale-[0.97]
					{tempChatEnabled
						? 'bg-primary/15 text-primary'
						: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}"
				onclick={() => tempChatEnabled = !tempChatEnabled}
				title="Temporary chat"
			>
				<MessageSquareDashedIcon class="size-4" />
			</button>

			<!-- Settings popover -->
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]"
							title="Settings"
						>
							<SettingsIcon class="size-4" />
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content align="end" side="bottom" class="w-56 p-3" sideOffset={8}>
					<!-- Theme selector -->
					<div class="space-y-3">
						<p class="text-sm font-semibold">Theme</p>
						<ToggleGroup.Root
							type="single"
							value={theme}
							onValueChange={(v) => { if (v) applyTheme(v as Theme); }}
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
						<button class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
							<SettingsIcon class="size-4" />
							Settings
						</button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	</div>

	<!-- Messages -->
	<div class="flex-1 overflow-y-auto">
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center pb-32">
				<div class="w-full max-w-2xl px-4">
					<h2 class="text-3xl font-semibold">How can I help you?</h2>

					<!-- Category tabs -->
					<div class="mt-6 flex flex-wrap items-center gap-1.5">
						{#each Object.keys(suggestions) as category}
							{@const isActive = activeCategory === category}
							<button
								class="suggestion-pill flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-all
									{isActive
										? 'bg-accent text-foreground shadow-sm'
										: 'text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm'}"
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
								class="suggestion-item flex w-full items-center border-b border-border px-1 py-3.5 text-left text-base text-muted-foreground transition-all hover:text-foreground"
								onclick={() => useSuggestion(prompt)}
							>
								{prompt}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<div class="mx-auto max-w-3xl space-y-6 p-4 pb-8">
				{#each messages as message}
					{#if message.role === 'user'}
						<div class="flex justify-end">
							<div class="max-w-[85%] rounded-2xl bg-muted/60 px-4 py-2.5">
								<p class="whitespace-pre-wrap text-base">{message.content}</p>
							</div>
						</div>
					{:else}
						<div class="assistant-msg group -mx-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/40">
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
								<MarkdownRenderer content={message.content} />
							{/if}
							{#if message.content}
								<div class="mt-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
	<div class="px-4 pb-4">
		<div class="mx-auto max-w-3xl rounded-2xl bg-muted/30 p-3">
			<!-- Textarea -->
			<Textarea
				bind:value={input}
				placeholder="Send a message..."
				class="min-h-[100px] max-h-[200px] resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0 md:text-base"
				rows={3}
				onkeydown={handleKeydown}
			/>

			<!-- Bottom row: model selector left, capability toggles right, send far right -->
			<div class="mt-3 flex items-center gap-2">
				<ModelSelector bind:selected={selectedModel} />

				<div class="flex flex-1 items-center justify-end gap-1.5">
					{#if currentModel?.capabilities.thinking}
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{thinkingEnabled
									? 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={() => thinkingEnabled = !thinkingEnabled}
						>
							<BrainIcon class="size-4" />
							<span>Think</span>
						</button>
					{/if}
					{#if currentModel?.capabilities.vision}
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{visionEnabled
									? 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={() => visionEnabled = !visionEnabled}
						>
							<EyeIcon class="size-4" />
							<span>Vision</span>
						</button>
					{/if}
					{#if currentModel?.capabilities.files}
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{filesEnabled
									? 'bg-pink-500/15 text-pink-600 ring-1 ring-pink-500/30'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={() => filesEnabled = !filesEnabled}
						>
							<PaperclipIcon class="size-4" />
							<span>File</span>
						</button>
					{/if}
					{#if currentModel?.capabilities.webSearch}
						<button
							class="capability-toggle flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-all
								{webSearchEnabled
									? 'bg-teal-500/15 text-teal-600 ring-1 ring-teal-500/30'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={() => webSearchEnabled = !webSearchEnabled}
						>
							<GlobeIcon class="size-4" />
							<span>Search</span>
						</button>
					{/if}
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
</style>
