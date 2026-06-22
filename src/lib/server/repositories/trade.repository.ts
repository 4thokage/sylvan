import { supabase } from '$lib/server/supabase';
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
		const { data: user } = await supabase
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async getPublicWishlists(limit = 50, offset = 0) {
		const { data: wishlists } = await supabase
			.from('wishlists')
			.select('*')
			.eq('visibility', 'public')
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		return (wishlists || []) as WishlistRow[];
	},

	async getWishlistItems(wishlistIds: string[]) {
		const { data: items } = await supabase
			.from('wishlist_items')
			.select('wishlist_id, card_id, quantity')
			.in('wishlist_id', wishlistIds);

		return (items || []) as WishlistItemRow[];
	},

	async getWishlistItemsByCardIds(cardIds: string[]) {
		const { data: items } = await supabase
			.from('wishlist_items')
			.select('*')
			.in('card_id', cardIds);

		return (items || []) as WishlistItemRow[];
	},

	async getCardIdsByPrintingIds(printingIds: string[]) {
		const { data: printings } = await supabase
			.from('card_printings')
			.select('id, card_id')
			.in('id', printingIds);

		return (printings || []) as Array<{ id: string; card_id: string }>;
	},

	async getCardPrintingPrices(cardIds: string[]) {
		const { data: prices } = await supabase
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

	async createTrade(trade) {
		const { data } = await supabase
			.from('trades')
			.insert({
				proposer_id: trade.proposer_id,
				recipient_id: trade.recipient_id,
				status: 'pending',
				proposer_note: trade.proposer_note || null
			})
			.select()
			.single();

		if (!data) throw new Error('Failed to create trade');
		return data as TradeRow;
	},

	async getTradeById(tradeId: string) {
		const { data: trade } = await supabase.from('trades').select('*').eq('id', tradeId).single();
		return trade as TradeRow | null;
	},

	async getTradesForUser(userDbId: string, limit = 50) {
		const { data: trades } = await supabase
			.from('trades')
			.select(
				`
        *,
        proposer:proposer_id(id, username),
        recipient:recipient_id(id, username)
      `
			)
			.or(`proposer_id.eq.${userDbId},recipient_id.eq.${userDbId}`)
			.order('created_at', { ascending: false })
			.limit(limit);

		return (trades || []) as TradeWithProfiles[];
	},

	async updateTradeStatus(tradeId, status, completedAt?) {
		const updates: Record<string, unknown> = { status };
		if (completedAt) updates.completed_at = completedAt;
		await supabase.from('trades').update(updates).eq('id', tradeId);
	},

	async updateCurrentOffer(tradeId, offerId) {
		await supabase.from('trades').update({ current_offer_id: offerId }).eq('id', tradeId);
	},

	async createTradeOffer(offer) {
		const { data } = await supabase
			.from('trade_offers')
			.insert({
				trade_id: offer.trade_id,
				offered_by: offer.offered_by
			})
			.select()
			.single();

		if (!data) throw new Error('Failed to create trade offer');
		return data as TradeOfferRow;
	},

	async createTradeOfferItems(items) {
		if (items.length === 0) return;
		const { error } = await supabase.from('trade_offer_items').insert(items);
		if (error) throw new Error(error.message);
	},

	async getTradeOffers(tradeId: string) {
		const { data } = await supabase
			.from('trade_offers')
			.select('*')
			.eq('trade_id', tradeId)
			.order('created_at', { ascending: false });

		return (data || []) as TradeOfferRow[];
	},

	async getTradeOfferItems(offerId: string) {
		const { data } = await supabase.from('trade_offer_items').select('*').eq('offer_id', offerId);

		return (data || []) as TradeOfferItemRow[];
	},

	async getBlockedUserIds(blockerId: string) {
		const { data: blocked } = await supabase
			.from('blocked_users')
			.select('blocked_id')
			.eq('blocker_id', blockerId);

		return (blocked || []).map((b) => b.blocked_id);
	}
};
