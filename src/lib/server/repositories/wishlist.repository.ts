import { getSupabase } from '$lib/server/supabase';
import type { WishlistRepository, WishlistRow, WishlistItemRow } from './types';

export const wishlistRepository: WishlistRepository = {
	async getUserIdByClerkId(clerkUserId: string) {
		const { data: user } = await getSupabase()
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async getGameId(gameSlug: string) {
		const { data: game } = await getSupabase()
			.from('games')
			.select('id')
			.eq('slug', gameSlug)
			.maybeSingle();
		return game?.id || null;
	},

	async createWishlist(wishlist) {
		const { error } = await getSupabase().rpc('create_wishlist', {
			p_id: wishlist.id,
			p_user_id: wishlist.user_id,
			p_game_id: wishlist.game_id,
			p_title: wishlist.title,
			p_owner_name: wishlist.owner_name,
			p_creator_fingerprint: wishlist.creator_fingerprint,
			p_visibility: wishlist.visibility,
			p_items: wishlist.items.map((item) => ({
				card_id: item.card_id,
				card_printing_id: item.card_printing_id ?? null,
				quantity: item.quantity,
				condition: item.condition ?? null,
				finish: item.finish ?? null,
				aftermarket_signed: item.aftermarket_signed ?? null,
				is_altered: item.is_altered ?? null,
				language: item.language ?? null
			}))
		});
		if (error) throw new Error(error.message);
	},

	async getWishlist(id: string) {
		const { data: wishlist } = await getSupabase()
			.from('wishlists')
			.select('*')
			.eq('id', id)
			.single();

		if (!wishlist) return { wishlist: null, items: [] };

		const { data: items } = await getSupabase()
			.from('wishlist_items')
			.select('*')
			.eq('wishlist_id', id);

		return {
			wishlist: wishlist as WishlistRow,
			items: (items || []) as WishlistItemRow[]
		};
	},

	async deleteWishlistByUser(id: string, userId: string) {
		const { error } = await getSupabase().rpc('delete_wishlist', {
			p_wishlist_id: id,
			p_user_id: userId,
			p_fingerprint: null
		});
		if (error) throw new Error(error.message);
	},

	async deleteWishlistByFingerprint(id: string, fingerprint: string) {
		const { error } = await getSupabase().rpc('delete_wishlist', {
			p_wishlist_id: id,
			p_user_id: null,
			p_fingerprint: fingerprint
		});
		if (error) throw new Error(error.message);
	},

	async listPublicWishlists(limit = 100, offset = 0) {
		const { data: wishlists } = await getSupabase()
			.from('wishlists')
			.select('*')
			.eq('visibility', 'public')
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		return (wishlists || []) as WishlistRow[];
	},

	async getWishlistFingerprint(id: string) {
		const { data } = await getSupabase()
			.from('wishlists')
			.select('creator_fingerprint')
			.eq('id', id)
			.single();
		return data?.creator_fingerprint || null;
	},

	async listUserWishlists(userId: string, limit = 50, offset = 0) {
		const { data: wishlists } = await getSupabase()
			.from('wishlists')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);
		return (wishlists || []) as WishlistRow[];
	}
};
