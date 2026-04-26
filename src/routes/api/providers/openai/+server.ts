import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'OpenAI models require a Pro subscription. Upgrade to access GPT and o-series models.' },
		{ status: 403 }
	);
};
