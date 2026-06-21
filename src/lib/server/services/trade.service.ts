import type { TradeRepository } from '$lib/server/repositories/types';
import { tradeRepository as defaultRepo } from '$lib/server/repositories/trade.repository';

export interface TradeMatch {
  wishlistId: string;
  wishlistOwner: string;
  userId: string | null;
  cardsYouHave: Array<{ name: string; qty: number; price: number }>;
  valueYouGive: number;
  score: number;
}

export async function findMatchesForCollection(
  collection: Array<{ name: string; qty: number }>,
  repo?: TradeRepository
) {
  const r = repo || defaultRepo;

  const collectionMap = new Map<string, number>();
  for (const c of collection) {
    const key = c.name.toLowerCase();
    collectionMap.set(key, (collectionMap.get(key) || 0) + c.qty);
  }

  const wishlists = await r.getPublicWishlists(200, 0);
  if (wishlists.length === 0) return [];

  const wishlistIds = wishlists.map((w) => w.id);
  const items = await r.getWishlistItems(wishlistIds);
  if (items.length === 0) return [];

  const wishlistCardMap = new Map<string, Array<{ name: string; qty: number }>>();
  for (const item of items) {
    const existing = wishlistCardMap.get(item.wishlist_id) || [];
    existing.push({ name: item.card_name, qty: item.quantity });
    wishlistCardMap.set(item.wishlist_id, existing);
  }

  const allMatchedNames = new Set<string>();
  const matches: TradeMatch[] = [];

  for (const wishlist of wishlists) {
    const wishlistCards = wishlistCardMap.get(wishlist.id) || [];
    const cardsYouHave: Array<{ name: string; qty: number; price: number }> = [];

    let valueYouGive = 0;
    let wishlistValue = 0;

    for (const card of wishlistCards) {
      const key = card.name.toLowerCase();
      const inCollection = collectionMap.get(key) || 0;

      if (inCollection > 0) {
        const canGive = Math.min(card.qty, inCollection);
        allMatchedNames.add(card.name);
        cardsYouHave.push({ name: card.name, qty: canGive, price: 0 });
        valueYouGive += canGive;
      }

      wishlistValue += card.qty;
    }

    if (cardsYouHave.length > 0) {
      const valueRatio = wishlistValue > 0 ? Math.min(valueYouGive / wishlistValue, 1) : 0;
      const cardRatio = cardsYouHave.length / Math.max(wishlistCards.length, 1);
      const score = Math.round(valueRatio * 50 + cardRatio * 50);

      matches.push({
        wishlistId: wishlist.id,
        wishlistOwner: wishlist.owner_name || 'Anonymous',
        userId: wishlist.user_id,
        cardsYouHave,
        valueYouGive,
        score
      });
    }
  }

  if (allMatchedNames.size > 0) {
    const prices = await r.getCardPrintingPrices([...allMatchedNames]);
    const priceByName = new Map(prices.map(p => [p.cardName, p.price]));
    for (const match of matches) {
      for (const card of match.cardsYouHave) {
        card.price = priceByName.get(card.name.toLowerCase()) || 0;
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export async function findUsersWhoWantCards(
  cardNames: string[],
  currentUserId: string,
  repo?: TradeRepository
): Promise<TradeMatch[]> {
  const r = repo || defaultRepo;

  const normalizedNames = cardNames.map((n) => n.toLowerCase());

  const items = await r.getWishlistItems([]);
  const filtered = items.filter(i => normalizedNames.includes(i.card_name.toLowerCase()));
  if (filtered.length === 0) return [];

  const wishlistIds = [...new Set(filtered.map((i) => i.wishlist_id))];
  const wishlists = (await r.getPublicWishlists(200, 0))
    .filter(w => wishlistIds.includes(w.id) && w.user_id !== currentUserId);

  return wishlists.map((w) => {
    const wantedItems = filtered.filter((i) => i.wishlist_id === w.id);
    const cardsYouHave = wantedItems.map((i) => ({
      name: i.card_name,
      qty: i.quantity,
      price: 0
    }));

    return {
      wishlistId: w.id,
      wishlistOwner: w.owner_name || 'Anonymous',
      userId: w.user_id,
      cardsYouHave,
      valueYouGive: cardsYouHave.length,
      score: Math.round((cardsYouHave.length / Math.max(cardsYouHave.length, 1)) * 100)
    };
  });
}

export async function createTradeProposal(
  proposerClerkId: string,
  recipientId: string,
  offeredCardIds: string[],
  requestedCardIds: string[],
  note?: string,
  repo?: TradeRepository
) {
  const r = repo || defaultRepo;

  const proposerId = await r.getUserIdByClerkId(proposerClerkId);
  if (!proposerId) throw new Error('Proposer not found');

  const trade = await r.createTrade({
    proposer_id: proposerId,
    recipient_id: recipientId,
    proposer_note: note || null
  });

  const items = [
    ...offeredCardIds.map((id) => ({ trade_id: trade.id, user_card_id: id, side: 'offer' })),
    ...requestedCardIds.map((id) => ({ trade_id: trade.id, user_card_id: id, side: 'request' }))
  ];

  await r.createTradeItems(items);

  return trade;
}

export async function getTradeById(tradeId: string, repo?: TradeRepository) {
  const r = repo || defaultRepo;
  return r.getTradeById(tradeId);
}

export async function getTradesForUser(clerkUserId: string, repo?: TradeRepository) {
  const r = repo || defaultRepo;
  const userId = await r.getUserIdByClerkId(clerkUserId);
  if (!userId) return [];
  return r.getTradesForUser(userId);
}

export async function updateTradeStatus(
  clerkUserId: string,
  tradeId: string,
  status: 'accepted' | 'rejected' | 'cancelled',
  repo?: TradeRepository
) {
  const r = repo || defaultRepo;

  const userId = await r.getUserIdByClerkId(clerkUserId);
  if (!userId) throw new Error('User not found');

  const trade = await r.getTradeById(tradeId);
  if (!trade) throw new Error('Trade not found');

  if (trade.proposer_id !== userId && trade.recipient_id !== userId) {
    throw new Error('Not a participant in this trade');
  }

  if (status === 'accepted') {
    await r.updateTradeStatus(tradeId, 'accepted', new Date().toISOString());
  } else {
    await r.updateTradeStatus(tradeId, status);
  }

  return { success: true };
}

export async function createCounterOffer(
  clerkUserId: string,
  tradeId: string,
  offeredCardIds: string[],
  requestedCardIds: string[],
  notes?: string,
  repo?: TradeRepository
) {
  const r = repo || defaultRepo;

  const userId = await r.getUserIdByClerkId(clerkUserId);
  if (!userId) throw new Error('User not found');

  const trade = await r.getTradeById(tradeId);
  if (!trade) throw new Error('Trade not found');

  if (trade.recipient_id !== userId) {
    throw new Error('Only the recipient can counter-offer');
  }

  if (trade.status !== 'pending') {
    throw new Error('Trade is not in pending status');
  }

  await r.createCounterOffer({
    trade_id: tradeId,
    offered_by: userId,
    status: 'pending',
    notes: notes || null
  });

  await r.deleteTradeItems(tradeId);

  const items = [
    ...offeredCardIds.map((id) => ({ trade_id: tradeId, user_card_id: id, side: 'offer' })),
    ...requestedCardIds.map((id) => ({ trade_id: tradeId, user_card_id: id, side: 'request' }))
  ];

  await r.createTradeItems(items);

  return { success: true };
}

export async function getBlockedUserIds(clerkUserId: string, repo?: TradeRepository): Promise<string[]> {
  const r = repo || defaultRepo;
  const userId = await r.getUserIdByClerkId(clerkUserId);
  if (!userId) return [];
  return r.getBlockedUserIds(userId);
}
