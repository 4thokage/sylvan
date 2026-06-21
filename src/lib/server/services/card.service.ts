import { supabase } from '$lib/server/supabase';
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
		collectorNumber: string;
		rarity: string;
		imageUrl: string | null;
		marketPriceUsd: number | null;
		marketPriceEur: number | null;
	}>;
}

export async function findOrCreateCard(
	gameSlug: string,
	name: string,
	set?: string,
	collectorNumber?: string,
	oracleId?: string | null
): Promise<CardLookupResult | null> {
	const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();

	if (!game) return null;

	const provider = getProvider(gameSlug);
	const normalizedName = provider.normalizeName(name);

	// Try to find existing card
	let { data: card } = await supabase
		.from('cards')
		.select('*, card_printings(*)')
		.eq('normalized_name', normalizedName)
		.eq('game_id', game.id)
		.maybeSingle();

	if (!card && oracleId) {
		const { data: cardByOracle } = await supabase
			.from('cards')
			.select('*, card_printings(*)')
			.eq('oracle_id', oracleId)
			.eq('game_id', game.id)
			.maybeSingle();
		card = cardByOracle;
	}

	if (!card) {
		// Card not found - fetch from provider and create
		let providerCard = await getCard(gameSlug, name, set, collectorNumber);
		if (!providerCard) {
			providerCard = await provider.fuzzySearchCard(name);
		}
		if (!providerCard) return null;

		// Create card
		const { data: newCard, error: cardError } = await supabase
			.from('cards')
			.insert({
				game_id: game.id,
				oracle_id: providerCard.oracleId || null,
				name: providerCard.name,
				normalized_name: providerCard.normalizedName,
				image_url: providerCard.imageUrl || null,
				game_data: { type_line: providerCard.typeLine }
			})
			.select()
			.single();

		if (cardError || !newCard) {
			console.error('[CardService] Failed to create card:', cardError);
			return null;
		}

		// Create printing
		const { data: newPrinting, error: printingError } = await supabase
			.from('card_printings')
			.insert({
				card_id: newCard.id,
				game_id: game.id,
				set_code: providerCard.setCode,
				set_name: providerCard.setName,
				collector_number: providerCard.collectorNumber,
				rarity: providerCard.rarity,
				image_url: providerCard.imageUrl || null,
				market_price_usd: providerCard.prices?.usd ? parseFloat(providerCard.prices.usd) : null,
				market_price_eur: providerCard.prices?.eur ? parseFloat(providerCard.prices.eur) : null,
				last_price_update: new Date().toISOString()
			})
			.select()
			.single();

		if (printingError || !newPrinting) {
			console.error('[CardService] Failed to create printing:', printingError);
			return null;
		}

		card = {
			...newCard,
			card_printings: [newPrinting]
		};
	}

	return {
		id: card.id,
		name: card.name,
		normalizedName: card.normalized_name,
		imageUrl: card.image_url,
		gameData: card.game_data as Record<string, unknown>,
		printings: (card.card_printings || []).map((p: Record<string, unknown>) => ({
			id: p.id as string,
			setCode: p.set_code as string,
			setName: p.set_name as string,
			collectorNumber: p.collector_number as string,
			rarity: p.rarity as string,
			imageUrl: p.image_url as string | null,
			marketPriceUsd: p.market_price_usd as number | null,
			marketPriceEur: p.market_price_eur as number | null
		}))
	};
}

export async function searchCards(query: string, gameSlug: string, limit = 25) {
	const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();

	if (!game) return [];

	const { data: cards } = await supabase
		.from('cards')
		.select('id, name, normalized_name, image_url, game_data, game_id')
		.eq('game_id', game.id)
		.textSearch('normalized_name', query, { type: 'websearch' })
		.limit(limit);

	return cards || [];
}
