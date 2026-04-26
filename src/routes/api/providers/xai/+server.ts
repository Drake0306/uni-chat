import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'xAI (Grok) requires a Pro subscription. Upgrade to access Grok models.' },
		{ status: 403 }
	);
};
