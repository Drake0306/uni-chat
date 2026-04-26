import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Perplexity requires a Pro subscription. Upgrade to access Sonar search models.' },
		{ status: 403 }
	);
};
