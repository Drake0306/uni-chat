import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Qwen direct API requires a Pro subscription. Use the free Qwen3 Coder via OpenRouter instead.' },
		{ status: 403 }
	);
};
