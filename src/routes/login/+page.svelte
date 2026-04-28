<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import GoogleIcon from '$lib/components/google-icon.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';

	$effect(() => {
		if (!authStore.loading && authStore.isAuthenticated) {
			goto('/', { replaceState: true });
		}
	});

	let signingIn = $state(false);

	async function handleSignIn() {
		if (signingIn) return;
		signingIn = true;
		try {
			await authStore.signInWithGoogle();
		} finally {
			signingIn = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Uni Chat</title>
</svelte:head>

<div class="flex min-h-svh w-full items-center justify-center bg-background px-4">
	<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
		<div class="mb-6 flex flex-col items-center gap-1.5">
			<h1 class="text-xl font-semibold">Sign in to Uni Chat</h1>
			<p class="text-sm text-muted-foreground">
				Continue with your Google account
			</p>
		</div>

		<Button
			variant="outline"
			class="w-full justify-center gap-2 text-sm font-semibold"
			onclick={handleSignIn}
			disabled={signingIn || authStore.loading}
		>
			<GoogleIcon class="size-4" />
			{signingIn ? 'Redirecting…' : 'Continue with Google'}
		</Button>

		<p class="mt-6 text-center text-xs text-muted-foreground">
			New here? Signing in creates your account automatically.
		</p>
	</div>
</div>
