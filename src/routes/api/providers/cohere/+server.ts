import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Cohere requires a Pro subscription. Upgrade to access Command R models.' },
		{ status: 403 }
	);
};
