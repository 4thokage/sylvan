import { getSupabase } from '$lib/server/supabase';
import type { TradeRepository, WishlistRow, CardCondition } from '$lib/server/repositories/types';
import { tradeRepository as defaultRepo } from '$lib/server/repositories/trade.repository';

export interface TradeMatch {
	wishlistId: string;
	wishlistOwner: string;
	userId: string | null;
	cardsYouHave: Array<{
		name: string;
		qty: number;
		price: number;
		userCardId: string;
		finish: string | null;
		condition: string;
	}>;
	valueYouGive: number;
	score: number;
}

export interface TradeItemInput {
	userCardId: string;
	quantity: number;
}

interface CollectionStack {
	userCardId: string;
	cardPrintingId: string;
	cardId: string;
	cardName: string;
	quantity: number;
	condition: CardCondition;
	finish: string | null;
	aftermarketSigned: boolean;
	isAltered: boolean;
	language: string | null;
	isTradeable: boolean;
	price: number;
}

const CONDITION_RANK: Record<CardCondition, number> = {
	NM: 1,
	LP: 2,
	MP: 3,
	HP: 4,
	DMG: 5
};

function conditionMatches(required: CardCondition | null, stack: CardCondition) {
	if (!required) return true;
	return CONDITION_RANK[stack] <= CONDITION_RANK[required];
}

function filterMatches(
	item: {
		card_printing_id: string | null;
		condition: CardCondition | null;
		finish: string | null;
		aftermarket_signed: boolean | null;
		is_altered: boolean | null;
		language: string | null;
	},
	stack: CollectionStack
) {
	if (item.card_printing_id && item.card_printing_id !== stack.cardPrintingId) return false;
	if (!conditionMatches(item.condition, stack.condition)) return false;
	if (item.finish && item.finish !== stack.finish) return false;
	if (item.aftermarket_signed !== null && item.aftermarket_signed !== stack.aftermarketSigned)
		return false;
	if (item.is_altered !== null && item.is_altered !== stack.isAltered) return false;
	if (item.language && item.language !== stack.language) return false;
	return true;
}

export async function findMatchesForCollection(
	currentUserDbId: string | null,
	collection: Array<{
		id: string;
		cardPrintingId: string;
		cardName: string;
		quantity: number;
		condition: CardCondition;
		finish: string | null;
		aftermarketSigned: boolean;
		isAltered: boolean;
		language: string | null;
		isTradeable: boolean;
		marketPriceEur: number | null;
	}>,
	repo?: TradeRepository
) {
	const r = repo || defaultRepo;

	const tradeableStacks = collection.filter((c) => c.isTradeable);
	if (tradeableStacks.length === 0) return [];

	const printingIds = tradeableStacks.map((c) => c.cardPrintingId);
	const printings = await r.getCardIdsByPrintingIds(printingIds);

	const cardIdByPrinting = new Map<string, string>();
	for (const p of printings) {
		cardIdByPrinting.set(p.id, p.card_id);
	}

	const stacks: CollectionStack[] = [];
	for (const c of tradeableStacks) {
		const cardId = cardIdByPrinting.get(c.cardPrintingId);
		if (!cardId) continue;
		stacks.push({
			userCardId: c.id,
			cardPrintingId: c.cardPrintingId,
			cardId,
			cardName: c.cardName,
			quantity: c.quantity,
			condition: c.condition,
			finish: c.finish,
			aftermarketSigned: c.aftermarketSigned,
			isAltered: c.isAltered,
			language: c.language,
			isTradeable: true,
			price: c.marketPriceEur || 0
		});
	}

	const stacksByCardId = new Map<string, CollectionStack[]>();
	for (const s of stacks) {
		const list = stacksByCardId.get(s.cardId) || [];
		list.push(s);
		stacksByCardId.set(s.cardId, list);
	}

	if (stacksByCardId.size === 0) return [];

	let wishlists = await r.getPublicWishlists(200, 0);
	if (currentUserDbId) {
		wishlists = wishlists.filter((w) => w.user_id !== currentUserDbId);
	}
	if (wishlists.length === 0) return [];

	const blockedSet = new Set<string>();
	if (currentUserDbId) {
		const blocked = await r.getBlockedUserIds(currentUserDbId);
		const blockedBy = await r.getUsersBlocking(currentUserDbId);
		for (const id of [...blocked, ...blockedBy]) blockedSet.add(id);
	}
	wishlists = wishlists.filter((w) => !w.user_id || !blockedSet.has(w.user_id));

	const wishlistIds = wishlists.map((w: WishlistRow) => w.id);
	const items = await r.getWishlistItems(wishlistIds);
	if (items.length === 0) return [];

	const itemsByWishlist = new Map<string, typeof items>();
	for (const item of items) {
		const list = itemsByWishlist.get(item.wishlist_id) || [];
		list.push(item);
		itemsByWishlist.set(item.wishlist_id, list);
	}

	const matches: TradeMatch[] = [];

	for (const wishlist of wishlists) {
		const wishlistItems = itemsByWishlist.get(wishlist.id) || [];
		const cardsYouHave: TradeMatch['cardsYouHave'] = [];
		let valueYouGive = 0;
		let wishlistValue = 0;

		for (const item of wishlistItems) {
			const candidates = stacksByCardId.get(item.card_id) || [];
			let remaining = item.quantity;

			for (const stack of candidates) {
				if (remaining <= 0) break;
				if (!filterMatches(item, stack)) continue;
				const qty = Math.min(remaining, stack.quantity);
				remaining -= qty;

				cardsYouHave.push({
					name: stack.cardName,
					qty,
					price: stack.price,
					userCardId: stack.userCardId,
					finish: stack.finish,
					condition: stack.condition
				});
				valueYouGive += qty * stack.price;
			}

			wishlistValue += item.quantity;
		}

		if (cardsYouHave.length > 0) {
			const valueRatio =
				wishlistValue > 0
					? Math.min(cardsYouHave.reduce((s, c) => s + c.qty, 0) / wishlistValue, 1)
					: 0;
			const cardRatio =
				new Set(cardsYouHave.map((c) => c.name)).size / Math.max(wishlistItems.length, 1);
			const score = Math.round(valueRatio * 50 + cardRatio * 50);

			matches.push({
				wishlistId: wishlist.id,
				wishlistOwner: wishlist.username || wishlist.owner_name || 'Anonymous',
				userId: wishlist.user_id,
				cardsYouHave,
				valueYouGive: Math.round(valueYouGive * 100) / 100,
				score
			});
		}
	}

	return matches.sort((a, b) => b.score - a.score || b.valueYouGive - a.valueYouGive);
}

export async function createTradeProposal(
	proposerClerkId: string,
	recipientId: string,
	offeredItems: TradeItemInput[],
	requestedItems: TradeItemInput[],
	note?: string,
	repo?: TradeRepository
) {
	const r = repo || defaultRepo;

	const proposerId = await r.getUserIdByClerkId(proposerClerkId);
	if (!proposerId) throw new Error('Proposer not found');

	const { data: tradeId, error } = await getSupabase().rpc('create_trade', {
		p_proposer_id: proposerId,
		p_recipient_id: recipientId,
		p_offered_items: offeredItems.map((i) => ({
			user_card_id: i.userCardId,
			quantity: i.quantity
		})),
		p_requested_items: requestedItems.map((i) => ({
			user_card_id: i.userCardId,
			quantity: i.quantity
		})),
		p_note: note || null
	});

	if (error) throw new Error(error.message);
	if (!tradeId) throw new Error('Failed to create trade');

	return { id: tradeId as string };
}

export async function getTradeById(tradeId: string, repo?: TradeRepository) {
	const r = repo || defaultRepo;
	return r.getTradeById(tradeId);
}

export async function getTradeDetails(tradeId: string) {
	const { data, error } = await getSupabase().rpc('get_trade_details', {
		p_trade_id: tradeId
	});
	if (error) throw new Error(error.message);
	return data as Record<string, unknown> | null;
}

export async function getCounterpartyStacks(tradeId: string) {
	const { data, error } = await getSupabase().rpc('get_counterparty_stacks', {
		p_trade_id: tradeId
	});
	if (error) throw new Error(error.message);
	return (data || []) as Array<Record<string, unknown>>;
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

	if (status === 'cancelled') {
		const { error } = await getSupabase().rpc('cancel_trade', {
			p_trade_id: tradeId,
			p_user_id: userId
		});
		if (error) throw new Error(error.message);
		return { success: true };
	}

	const { error } = await getSupabase().rpc('respond_to_offer', {
		p_trade_id: tradeId,
		p_user_id: userId,
		p_action: status === 'accepted' ? 'accept' : 'reject'
	});
	if (error) throw new Error(error.message);

	return { success: true };
}

export async function createCounterOffer(
	clerkUserId: string,
	tradeId: string,
	offeredItems: TradeItemInput[],
	requestedItems: TradeItemInput[],
	note?: string,
	repo?: TradeRepository
) {
	const r = repo || defaultRepo;

	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) throw new Error('User not found');

	const { data: offerId, error } = await getSupabase().rpc('create_counter_offer', {
		p_trade_id: tradeId,
		p_offered_by: userId,
		p_offered_items: offeredItems.map((i) => ({
			user_card_id: i.userCardId,
			quantity: i.quantity
		})),
		p_requested_items: requestedItems.map((i) => ({
			user_card_id: i.userCardId,
			quantity: i.quantity
		})),
		p_note: note || null
	});

	if (error) throw new Error(error.message);
	if (!offerId) throw new Error('Failed to create counter offer');

	return { success: true, offerId: offerId as string };
}

export async function getTradeOffers(tradeId: string, repo?: TradeRepository) {
	const r = repo || defaultRepo;
	return r.getTradeOffers(tradeId);
}

export async function getTradeOfferItems(offerId: string, repo?: TradeRepository) {
	const r = repo || defaultRepo;
	return r.getTradeOfferItems(offerId);
}

export async function getBlockedUserIds(
	clerkUserId: string,
	repo?: TradeRepository
): Promise<string[]> {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) return [];
	return r.getBlockedUserIds(userId);
}
