import { supabase } from '$lib/server/supabase';
import type { WishlistRepository, WishlistRow, WishlistItemRow } from './types';

export const wishlistRepository: WishlistRepository = {
	async getUserIdByClerkId(clerkUserId: string) {
		const { data: user } = await supabase
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async getGameId(gameSlug: string) {
		const { data: game } = await supabase
			.from('games')
			.select('id')
			.eq('slug', gameSlug)
			.maybeSingle();
		return game?.id || null;
	},

	async createWishlist(wishlist) {
		const { error } = await supabase.from('wishlists').insert({
			id: wishlist.id,
			user_id: wishlist.user_id,
			game_id: wishlist.game_id,
			owner_name: wishlist.owner_name,
			creator_fingerprint: wishlist.creator_fingerprint,
			visibility: 'public',
			created_at: new Date().toISOString()
		});
		if (error) throw new Error(error.message);
	},

	async createWishlistItems(items) {
		if (items.length === 0) return;
		const { error } = await supabase.from('wishlist_items').insert(
			items.map((item) => ({
				wishlist_id: item.wishlist_id,
				card_id: item.card_id,
				card_printing_id: item.card_printing_id || null,
				quantity: item.quantity,
				condition: item.condition || 'NM',
				is_foil: item.is_foil || false,
				is_signed: item.is_signed || false,
				is_altered: item.is_altered || false,
				language: item.language || 'en'
			}))
		);
		if (error) console.error('[WishlistRepo] Error inserting items:', error);
	},

	async getWishlist(id: string) {
		const { data: wishlist } = await supabase.from('wishlists').select('*').eq('id', id).single();

		if (!wishlist) return { wishlist: null, items: [] };

		const { data: items } = await supabase.from('wishlist_items').select('*').eq('wishlist_id', id);

		return {
			wishlist: wishlist as WishlistRow,
			items: (items || []) as WishlistItemRow[]
		};
	},

	async deleteWishlistByUser(id: string, userId: string) {
		const { error } = await supabase.from('wishlists').delete().eq('id', id).eq('user_id', userId);
		if (error) throw new Error(error.message);
	},

	async deleteWishlistByFingerprint(id: string, fingerprint: string) {
		const { error } = await supabase
			.from('wishlists')
			.delete()
			.eq('id', id)
			.eq('creator_fingerprint', fingerprint);
		if (error) throw new Error(error.message);
	},

	async listPublicWishlists(limit = 100, offset = 0) {
		const { data: wishlists } = await supabase
			.from('wishlists')
			.select('*')
			.eq('visibility', 'public')
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		return (wishlists || []) as WishlistRow[];
	},

	async getWishlistFingerprint(id: string) {
		const { data } = await supabase
			.from('wishlists')
			.select('creator_fingerprint')
			.eq('id', id)
			.single();
		return data?.creator_fingerprint || null;
	}
};
