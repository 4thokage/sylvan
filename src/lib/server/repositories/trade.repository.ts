import { getSupabase } from '$lib/server/supabase';
import type {
	TradeRepository,
	TradeRow,
	TradeWithProfiles,
	TradeOfferRow,
	TradeOfferItemRow,
	WishlistItemRow,
	WishlistRow
} from './types';

export const tradeRepository: TradeRepository = {
	async getUserIdByClerkId(clerkUserId: string) {
		const { data: user } = await getSupabase()
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async getPublicWishlists(limit = 50, offset = 0) {
		const { data: wishlists } = await getSupabase()
			.from('wishlists')
			.select('*, users(username)')
			.eq('visibility', 'public')
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		return (
			(wishlists || []) as unknown as Array<
				WishlistRow & { users?: { username: string | null } | null }
			>
		).map((w) => ({
			...w,
			username: w.users?.username ?? null
		})) as WishlistRow[];
	},

	async getWishlistItems(wishlistIds: string[]) {
		const { data: items } = await getSupabase()
			.from('wishlist_items')
			.select('*')
			.in('wishlist_id', wishlistIds);

		return (items || []) as WishlistItemRow[];
	},

	async getWishlistItemsByCardIds(cardIds: string[]) {
		const { data: items } = await getSupabase()
			.from('wishlist_items')
			.select('*')
			.in('card_id', cardIds);

		return (items || []) as WishlistItemRow[];
	},

	async getCardIdsByPrintingIds(printingIds: string[]) {
		const { data: printings } = await getSupabase()
			.from('card_printings')
			.select('id, card_id')
			.in('id', printingIds);

		return (printings || []) as Array<{ id: string; card_id: string }>;
	},

	async getCardPrintingPrices(cardIds: string[]) {
		const { data: prices } = await getSupabase()
			.from('card_printings')
			.select('card_id, market_price_eur')
			.in('card_id', cardIds)
			.not('market_price_eur', 'is', null)
			.order('market_price_eur', { ascending: false });

		if (!prices) return [];

		const priceMap = new Map<string, number>();
		for (const p of prices) {
			if (!priceMap.has(p.card_id)) {
				priceMap.set(p.card_id, p.market_price_eur);
			}
		}

		return cardIds
			.filter((cid) => priceMap.has(cid))
			.map((cardId) => ({ cardId, price: priceMap.get(cardId)! }));
	},

	async getTradeById(tradeId: string) {
		const { data: trade } = await getSupabase()
			.from('trades')
			.select('*')
			.eq('id', tradeId)
			.single();
		return trade as TradeRow | null;
	},

	async getTradesForUser(userDbId: string, limit = 50) {
		const { data: trades } = await getSupabase()
			.from('trades')
			.select(
				`
        *,
        proposer:proposer_id!users(id, username),
        recipient:recipient_id!users(id, username)
      `
			)
			.or(`proposer_id.eq.${userDbId},recipient_id.eq.${userDbId}`)
			.order('created_at', { ascending: false })
			.limit(limit);

		return (trades || []) as TradeWithProfiles[];
	},

	async getTradeOffers(tradeId: string) {
		const { data } = await getSupabase()
			.from('trade_offers')
			.select('*')
			.eq('trade_id', tradeId)
			.order('created_at', { ascending: false });

		return (data || []) as TradeOfferRow[];
	},

	async getTradeOfferItems(offerId: string) {
		const { data } = await getSupabase()
			.from('trade_offer_items')
			.select('*')
			.eq('offer_id', offerId);

		return (data || []) as TradeOfferItemRow[];
	},

	async getBlockedUserIds(blockerId: string) {
		const { data: blocked } = await getSupabase()
			.from('blocked_users')
			.select('blocked_id')
			.eq('blocker_id', blockerId);

		return (blocked || []).map((b) => b.blocked_id);
	},

	async getUsersBlocking(blockedId: string) {
		const { data: blocked } = await getSupabase()
			.from('blocked_users')
			.select('blocker_id')
			.eq('blocked_id', blockedId);

		return (blocked || []).map((b) => b.blocker_id);
	}
};
