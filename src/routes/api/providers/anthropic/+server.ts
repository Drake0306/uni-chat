import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Anthropic (Claude) requires a Pro subscription. Upgrade to access Claude models.' },
		{ status: 403 }
	);
};
