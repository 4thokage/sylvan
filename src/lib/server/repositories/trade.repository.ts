import { supabase } from '$lib/server/supabase';
import type { TradeRepository, TradeRow } from './types';

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
      .select('id, owner_name, user_id, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return (wishlists || []) as Array<{ id: string; owner_name: string | null; user_id: string | null; created_at: string }>;
  },

  async getWishlistItems(wishlistIds: string[]) {
    const { data: items } = await supabase
      .from('wishlist_items')
      .select('wishlist_id, card_name, quantity')
      .in('wishlist_id', wishlistIds);

    return (items || []) as Array<{ wishlist_id: string; card_name: string; quantity: number }>;
  },

  async getCardPrintingPrices(cardNames: string[]) {
    const { data: cards } = await supabase
      .from('cards')
      .select('id, normalized_name')
      .in('normalized_name', cardNames.map(n => n.toLowerCase()));

    if (!cards || cards.length === 0) return [];

    const cardIds = cards.map(c => c.id);
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

    return cards
      .filter(c => priceMap.has(c.id))
      .map(c => ({ cardName: c.normalized_name, price: priceMap.get(c.id)! }));
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

  async createTradeItems(items) {
    if (items.length === 0) return;
    const { error } = await supabase.from('trade_items').insert(items);
    if (error) throw new Error(error.message);
  },

  async getTradeById(tradeId: string) {
    const { data: trade } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();
    return trade as TradeRow | null;
  },

  async getTradesForUser(userDbId: string, limit = 50) {
    const { data: trades } = await supabase
      .from('trades')
      .select(`
        *,
        proposer:proposer_id(id, display_name, username, avatar_url),
        recipient:recipient_id(id, display_name, username, avatar_url)
      `)
      .or(`proposer_id.eq.${userDbId},recipient_id.eq.${userDbId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    return trades || [];
  },

  async updateTradeStatus(tradeId, status, completedAt?) {
    const updates: Record<string, unknown> = { status };
    if (completedAt) updates.completed_at = completedAt;
    await supabase.from('trades').update(updates).eq('id', tradeId);
  },

  async createCounterOffer(offer) {
    const { error } = await supabase.from('trade_offers').insert({
      trade_id: offer.trade_id,
      offered_by: offer.offered_by,
      status: offer.status || 'pending',
      notes: offer.notes || null
    });
    if (error) throw new Error(error.message);
  },

  async deleteTradeItems(tradeId: string) {
    await supabase.from('trade_items').delete().eq('trade_id', tradeId);
  },

  async getBlockedUserIds(blockerId: string) {
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', blockerId);

    return (blocked || []).map((b) => b.blocked_id);
  }
};
