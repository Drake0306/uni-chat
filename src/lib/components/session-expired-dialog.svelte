<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';

	function handleSignIn() {
		authStore.acknowledgeSessionExpired();
		goto('/login');
	}

	// Dismissing without signing in (esc / click outside / Continue) just
	// clears the flag — the user keeps using the app at guest tier.
	function handleDismiss() {
		authStore.acknowledgeSessionExpired();
	}
</script>

<Dialog.Root
	open={authStore.sessionExpired}
	onOpenChange={(o) => {
		if (!o) handleDismiss();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>You've been signed out</Dialog.Title>
			<Dialog.Description>
				Your session has expired. Sign in again to continue with your account, or keep using the
				app as a guest.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="ghost" onclick={handleDismiss}>Continue as guest</Button>
			<Button onclick={handleSignIn}>Sign in</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
