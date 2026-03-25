import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const id = url.searchParams.get('id');
		const fingerprint = url.searchParams.get('fingerprint');

		if (!id || !fingerprint) {
			return new Response(
				JSON.stringify({ success: false, error: { message: 'Missing id or fingerprint' } }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const { data: wishlist, error: fetchError } = await supabase
			.from('wishlists')
			.select('creator_fingerprint')
			.eq('id', id)
			.single();

		if (fetchError || !wishlist) {
			return new Response(
				JSON.stringify({ success: false, error: { message: 'Wishlist not found' } }),
				{ status: 404, headers: { 'Content-Type': 'application/json' } }
			);
		}

		if (wishlist.creator_fingerprint !== fingerprint) {
			return new Response(
				JSON.stringify({
					success: false,
					error: { message: 'Not authorized to delete this wishlist' }
				}),
				{ status: 403, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const { error: deleteError } = await supabase.from('wishlists').delete().eq('id', id);

		if (deleteError) {
			return new Response(
				JSON.stringify({ success: false, error: { message: deleteError.message } }),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete wishlist';
		return new Response(JSON.stringify({ success: false, error: { message } }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
