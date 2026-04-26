import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'DeepSeek direct API requires a Pro subscription. Use the free DeepSeek R1 via OpenRouter instead.' },
		{ status: 403 }
	);
};
