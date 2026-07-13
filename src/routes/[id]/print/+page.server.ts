import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

interface PrintItemRow {
	quantity: number;
	cards: { name: string } | null;
}

export const load: PageServerLoad = async ({ params }) => {
	const { data: wishlist, error: dbError } = await getSupabase()
		.from('wishlists')
		.select('*')
		.eq('id', params.id)
		.single();

	if (dbError || !wishlist) {
		throw error(404, 'Wishlist not found');
	}

	const { data: items } = await getSupabase()
		.from('wishlist_items')
		.select('id, quantity, cards(name)')
		.eq('wishlist_id', params.id);

	return {
		wishlist: {
			...wishlist,
			cards:
				((items || []) as unknown as PrintItemRow[]).map((item) => ({
					card_name: item.cards?.name || 'Unknown',
					quantity: item.quantity
				})) || []
		}
	};
};
