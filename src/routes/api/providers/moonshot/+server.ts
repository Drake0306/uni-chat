import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Moonshot (Kimi) requires a Pro subscription. Upgrade to access Kimi models.' },
		{ status: 403 }
	);
};
