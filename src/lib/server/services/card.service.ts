import { supabase } from '$lib/server/supabase';

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
  oracleId?: string | null
): Promise<CardLookupResult | null> {
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .single();

  if (!game) return null;

  const normalizedName = name.toLowerCase().trim();

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

  if (card) {
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

  return null;
}

export async function searchCards(query: string, gameSlug: string, limit = 25) {
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .single();

  if (!game) return [];

  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, normalized_name, image_url, game_data, game_id')
    .eq('game_id', game.id)
    .textSearch('normalized_name', query, { type: 'websearch' })
    .limit(limit);

  return cards || [];
}
