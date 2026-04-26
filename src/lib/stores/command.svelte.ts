let open = $state(false);

export const commandStore = {
	get open() { return open; },
	set open(v: boolean) { open = v; },
};
