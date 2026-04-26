import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/** Reusable service role client — bypasses RLS. Server-side only. */
const serviceClient = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!);

export function getServiceClient() {
	return serviceClient;
}

/** Validate a user's JWT from the Authorization header. Returns user or null. */
export async function getAuthUser(request: Request) {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) return null;

	const token = authHeader.slice(7);
	const {
		data: { user },
		error,
	} = await serviceClient.auth.getUser(token);
	if (error || !user) return null;
	return user;
}
