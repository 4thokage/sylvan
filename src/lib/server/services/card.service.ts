import { getSupabase } from '$lib/server/supabase';
import { getCard, getProvider } from '$lib/api/card-service';

export interface CardLookupResult {
	id: string;
	name: string;
	normalizedName: string;
	imageUrl: string | null;
	gameData: Record<string, unknown>;
	printings: Array<{
		id: string;
		setCode: string;
		setName: string;
		collectorNumber: string | null;
		rarity: string | null;
		imageUrl: string | null;
		language: string;
		finish: string;
		factorySigned: boolean;
		marketPriceUsd: number | null;
		marketPriceEur: number | null;
	}>;
}

async function findCardByExternalRef(
	gameId: string,
	providerSlug: string,
	identifierType: string,
	externalId: string
): Promise<Record<string, unknown> | null> {
	const { data: ref } = await getSupabase()
		.from('card_external_refs')
		.select('cards(*)')
		.eq('provider_slug', providerSlug)
		.eq('identifier_type', identifierType)
		.eq('external_id', externalId)
		.maybeSingle();

	const card = (ref as { cards?: { game_id: string } & Record<string, unknown> } | null)?.cards;
	if (card && card.game_id === gameId) return card;
	return null;
}

async function findPrintingByExternalRef(
	providerSlug: string,
	identifierType: string,
	externalId: string
): Promise<Record<string, unknown> | null> {
	const { data: ref } = await getSupabase()
		.from('printing_external_refs')
		.select('card_printings(*)')
		.eq('provider_slug', providerSlug)
		.eq('identifier_type', identifierType)
		.eq('external_id', externalId)
		.maybeSingle();

	return (
		(ref as { card_printings?: Record<string, unknown> | null } | null)?.card_printings || null
	);
}

async function ensureCard(
	gameId: string,
	providerCard: {
		name: string;
		normalizedName: string;
		imageUrl: string | null;
		typeLine: string | null;
		externalRefs: Array<{ providerSlug: string; identifierType: string; externalId: string }>;
	}
): Promise<Record<string, unknown>> {
	// Try to find by normalized name first.
	const { data: existingCard } = await getSupabase()
		.from('cards')
		.select('*')
		.eq('normalized_name', providerCard.normalizedName)
		.eq('game_id', gameId)
		.maybeSingle();

	if (existingCard) return existingCard;

	// Try to find by any card-level external ref.
	for (const ref of providerCard.externalRefs) {
		const card = await findCardByExternalRef(
			gameId,
			ref.providerSlug,
			ref.identifierType,
			ref.externalId
		);
		if (card) return card;
	}

	// Create the card.
	const { data: newCard, error: cardError } = await getSupabase()
		.from('cards')
		.insert({
			game_id: gameId,
			name: providerCard.name,
			normalized_name: providerCard.normalizedName,
			image_url: providerCard.imageUrl || null,
			game_data: { type_line: providerCard.typeLine }
		})
		.select()
		.single();

	if (cardError || !newCard) {
		throw new Error(`Failed to create card: ${cardError?.message || 'unknown'}`);
	}

	// Store card-level external refs.
	if (providerCard.externalRefs.length > 0) {
		await getSupabase()
			.from('card_external_refs')
			.insert(
				providerCard.externalRefs.map((ref) => ({
					card_id: newCard.id,
					provider_slug: ref.providerSlug,
					identifier_type: ref.identifierType,
					external_id: ref.externalId
				}))
			);
	}

	return newCard;
}

async function ensurePrinting(
	cardId: string,
	gameId: string,
	printing: {
		id: string;
		setCode: string;
		setName: string;
		collectorNumber: string | null;
		rarity: string | null;
		imageUrl: string | null;
		language: string;
		finish: string;
		factorySigned: boolean;
		prices: { usd: string | null; eur: string | null };
		externalRefs: Array<{ providerSlug: string; identifierType: string; externalId: string }>;
	}
): Promise<Record<string, unknown>> {
	// Try to find by external ref first.
	for (const ref of printing.externalRefs) {
		const existing = await findPrintingByExternalRef(
			ref.providerSlug,
			ref.identifierType,
			ref.externalId
		);
		if (existing) return existing;
	}

	// Try to find by unique printing dimensions.
	const { data: existingByDims } = await getSupabase()
		.from('card_printings')
		.select('*')
		.eq('game_id', gameId)
		.eq('set_code', printing.setCode)
		.eq('collector_number', printing.collectorNumber || '')
		.eq('language', printing.language)
		.eq('finish', printing.finish)
		.eq('factory_signed', printing.factorySigned)
		.maybeSingle();

	if (existingByDims) return existingByDims;

	const { data: newPrinting, error: printingError } = await getSupabase()
		.from('card_printings')
		.insert({
			card_id: cardId,
			game_id: gameId,
			set_code: printing.setCode,
			set_name: printing.setName,
			collector_number: printing.collectorNumber,
			rarity: printing.rarity,
			language: printing.language,
			finish: printing.finish,
			factory_signed: printing.factorySigned,
			image_url: printing.imageUrl || null,
			market_price_usd: printing.prices.usd ? parseFloat(printing.prices.usd) : null,
			market_price_eur: printing.prices.eur ? parseFloat(printing.prices.eur) : null,
			last_price_update: new Date().toISOString()
		})
		.select()
		.single();

	if (printingError || !newPrinting) {
		throw new Error(`Failed to create printing: ${printingError?.message || 'unknown'}`);
	}

	if (printing.externalRefs.length > 0) {
		await getSupabase()
			.from('printing_external_refs')
			.insert(
				printing.externalRefs.map((ref) => ({
					printing_id: newPrinting.id,
					provider_slug: ref.providerSlug,
					identifier_type: ref.identifierType,
					external_id: ref.externalId
				}))
			);
	}

	return newPrinting;
}

export async function findOrCreateCard(
	gameSlug: string,
	name: string,
	set?: string,
	collectorNumber?: string
): Promise<CardLookupResult | null> {
	const { data: game } = await getSupabase()
		.from('games')
		.select('id')
		.eq('slug', gameSlug)
		.single();

	if (!game) return null;

	const provider = getProvider(gameSlug);
	const normalizedName = provider.normalizeName(name);

	// Try to find existing card by normalized name.
	const { data: existingCard } = await getSupabase()
		.from('cards')
		.select('*, card_printings(*)')
		.eq('normalized_name', normalizedName)
		.eq('game_id', game.id)
		.maybeSingle();

	let card = existingCard;

	if (!card) {
		// Card not found - fetch from provider and create.
		let providerCard = await getCard(gameSlug, name, set, collectorNumber);
		if (!providerCard) {
			providerCard = await provider.fuzzySearchCard(name);
		}
		if (!providerCard) return null;

		card = await ensureCard(game.id, providerCard);
		await ensurePrinting(card.id as string, game.id, providerCard);

		// Reload with printings.
		const { data: reloaded } = await getSupabase()
			.from('cards')
			.select('*, card_printings(*)')
			.eq('id', card.id)
			.single();
		card = reloaded;
	}

	return {
		id: card.id as string,
		name: card.name as string,
		normalizedName: card.normalized_name as string,
		imageUrl: card.image_url as string | null,
		gameData: card.game_data as Record<string, unknown>,
		printings: ((card.card_printings as Array<Record<string, unknown>>) || []).map((p) => ({
			id: p.id as string,
			setCode: p.set_code as string,
			setName: p.set_name as string,
			collectorNumber: p.collector_number as string | null,
			rarity: p.rarity as string | null,
			imageUrl: p.image_url as string | null,
			language: p.language as string,
			finish: p.finish as string,
			factorySigned: p.factory_signed as boolean,
			marketPriceUsd: p.market_price_usd as number | null,
			marketPriceEur: p.market_price_eur as number | null
		}))
	};
}

export async function searchCards(query: string, gameSlug: string, limit = 25) {
	const { data: game } = await getSupabase()
		.from('games')
		.select('id')
		.eq('slug', gameSlug)
		.single();

	if (!game) return [];

	const { data: cards } = await getSupabase()
		.from('cards')
		.select('id, name, normalized_name, image_url, game_data, game_id')
		.eq('game_id', game.id)
		.textSearch('normalized_name', query, { type: 'websearch' })
		.limit(limit);

	return cards || [];
}
