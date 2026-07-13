import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

interface WishlistItemRow {
	id: string;
	card_id: string;
	card_printing_id: string | null;
	quantity: number;
	condition: string | null;
	finish: string | null;
	aftermarket_signed: boolean | null;
	is_altered: boolean | null;
	language: string | null;
	cards: { name: string; image_url: string | null } | null;
	card_printings: {
		set_code: string | null;
		collector_number: string | null;
		finish: string | null;
		language: string | null;
		market_price_usd: number | null;
		market_price_eur: number | null;
		image_url: string | null;
	} | null;
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

	let gameSlug = 'mtg';
	if (wishlist.game_id) {
		const { data: game } = await getSupabase()
			.from('games')
			.select('slug')
			.eq('id', wishlist.game_id)
			.single();
		if (game) gameSlug = game.slug;
	}

	const { data: items } = await getSupabase()
		.from('wishlist_items')
		.select(
			'id, card_id, quantity, condition, finish, aftermarket_signed, is_altered, language, card_printing_id, cards(name, image_url), card_printings(set_code, collector_number, finish, language, market_price_usd, market_price_eur, image_url)'
		)
		.eq('wishlist_id', params.id);

	return {
		wishlist: {
			...wishlist,
			cards: ((items || []) as unknown as WishlistItemRow[]).map((item) => {
				const printing = item.card_printings;
				const card = item.cards;
				return {
					id: item.id,
					card_id: item.card_id,
					card_printing_id: item.card_printing_id,
					card_name: card?.name || 'Unknown',
					image_url: printing?.image_url || card?.image_url || null,
					quantity: item.quantity,
					condition: item.condition,
					finish: item.finish ?? printing?.finish ?? null,
					aftermarket_signed: item.aftermarket_signed,
					is_altered: item.is_altered,
					language: item.language ?? printing?.language ?? null,
					set_code: printing?.set_code || null,
					collector_number: printing?.collector_number || null,
					prices: printing
						? {
								usd: printing.market_price_usd?.toFixed(2) ?? null,
								eur: printing.market_price_eur?.toFixed(2) ?? null
							}
						: null
				};
			}),
			game_slug: gameSlug
		}
	};
};
