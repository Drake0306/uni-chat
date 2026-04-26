<script lang="ts">
	import { page } from '$app/state';
	import ChatView from '$lib/components/chat-view.svelte';
</script>

<ChatView chatId={page.params.id} />
