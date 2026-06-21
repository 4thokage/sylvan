import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const { data: wishlist, error: dbError } = await supabase
		.from('wishlists')
		.select('*')
		.eq('id', params.id)
		.single();

	if (dbError || !wishlist) {
		throw error(404, 'Wishlist not found');
	}

	let gameSlug = 'mtg';
	if (wishlist.game_id) {
		const { data: game } = await supabase
			.from('games')
			.select('slug')
			.eq('id', wishlist.game_id)
			.single();
		if (game) gameSlug = game.slug;
	}

	const { data: items } = await supabase
		.from('wishlist_items')
		.select('id, card_id, quantity, cards(name, image_url)')
		.eq('wishlist_id', params.id);

	return {
		wishlist: {
			...wishlist,
			cards: (items || []).map((item: any) => ({
				id: item.id,
				card_id: item.card_id,
				card_name: item.cards?.name || 'Unknown',
				image_url: item.cards?.image_url || null,
				quantity: item.quantity
			})),
			game_slug: gameSlug
		}
	};
};
