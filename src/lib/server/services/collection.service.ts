import { supabase } from '$lib/server/supabase';
import type { CollectionRepository, UserCardRow } from '$lib/server/repositories/types';
import { collectionRepository as defaultRepo } from '$lib/server/repositories/collection.repository';

export interface CollectionCard {
	id: string;
	cardPrintingId: string;
	cardName: string;
	imageUrl: string | null;
	quantity: number;
	condition: string;
	isFoil: boolean;
	isSigned: boolean;
	isAltered: boolean;
	language: string;
	isTradeable: boolean;
}

async function enrichCards(cards: UserCardRow[]): Promise<CollectionCard[]> {
	if (cards.length === 0) return [];

	const printingIds = cards.map((c) => c.card_printing_id);
	const { data: printings } = await supabase
		.from('card_printings')
		.select('id, image_url, cards(name)')
		.in('id', printingIds);

	const printingMap = new Map<string, { imageUrl: string | null; cardName: string }>();
	for (const p of (printings || []) as unknown as Array<{
		id: string;
		image_url: string | null;
		cards: { name: string } | null;
	}>) {
		printingMap.set(p.id, {
			imageUrl: p.image_url || null,
			cardName: p.cards?.name || 'Unknown'
		});
	}

	return cards.map((c) => {
		const info = printingMap.get(c.card_printing_id) || { imageUrl: null, cardName: 'Unknown' };
		return {
			id: c.id,
			cardPrintingId: c.card_printing_id,
			cardName: info.cardName,
			imageUrl: info.imageUrl,
			quantity: c.quantity,
			condition: c.condition,
			isFoil: c.is_foil,
			isSigned: c.is_signed,
			isAltered: c.is_altered,
			language: c.language,
			isTradeable: c.is_tradeable
		};
	});
}

export async function getCollection(
	clerkUserId: string,
	gameSlug?: string,
	repo?: CollectionRepository
) {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) return [];
	const cards = await r.getCollection(userId, gameSlug);
	return enrichCards(cards);
}

export async function getPublicCollection(
	userId: string,
	gameSlug?: string,
	repo?: CollectionRepository
) {
	const r = repo || defaultRepo;
	const cards = await r.getPublicCollection(userId, gameSlug);
	return enrichCards(cards);
}

export async function saveCollection(
	clerkUserId: string,
	cards: Array<{ card_printing_id: string; quantity: number }>,
	gameSlug = 'mtg',
	repo?: CollectionRepository
) {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) throw new Error('User not found');
	return r.saveCollection(userId, cards, gameSlug);
}

export async function replaceCollection(
	clerkUserId: string,
	cards: Array<{
		card_printing_id: string;
		quantity: number;
		condition?: string;
		is_foil?: boolean;
		is_signed?: boolean;
		is_altered?: boolean;
		language?: string;
		is_tradeable?: boolean;
	}>,
	gameSlug = 'mtg',
	repo?: CollectionRepository
) {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) throw new Error('User not found');
	return r.replaceCollection(userId, cards, gameSlug);
}

export async function clearCollection(
	clerkUserId: string,
	gameSlug?: string,
	repo?: CollectionRepository
) {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) return;
	return r.clearCollection(userId, gameSlug);
}
