import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBenchmarks } from '$lib/server/benchmarks.js';

// GET /api/benchmarks?slug=<aa-slug>
// Returns the cached Artificial Analysis benchmarks for a model, or
// { benchmarks: null } when AA doesn't track it / no API key configured.

export const GET: RequestHandler = async ({ url }) => {
	const slug = url.searchParams.get('slug') ?? undefined;
	const benchmarks = await getBenchmarks(slug);
	return json({ benchmarks });
};
