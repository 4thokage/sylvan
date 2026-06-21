import type { TcgCard, TcgPrinting, TcgProvider, TcgSearchResult } from './providers/types';
import { scryfallProvider } from './providers/scryfall';
import { pokemonProvider } from './providers/pokemon';
import { riftboundProvider } from './providers/riftbound';
import { supabase } from '$lib/server/supabase';

const providers: Record<string, TcgProvider> = {
  mtg: scryfallProvider,
  pokemon: pokemonProvider,
  riftbound: riftboundProvider
};

export const SUPPORTED_GAMES: Array<{ slug: string; name: string }> = [
  { slug: 'mtg', name: 'Magic: The Gathering' },
  { slug: 'pokemon', name: 'Pokémon TCG' },
  { slug: 'riftbound', name: 'Riftbound' }
];

function getProvider(gameSlug: string): TcgProvider {
  const provider = providers[gameSlug];
  if (!provider) throw new Error(`Unsupported game: ${gameSlug}`);
  return provider;
}

export async function searchCards(gameSlug: string, query: string, limit = 25): Promise<TcgSearchResult> {
  return getProvider(gameSlug).searchCards(query, limit);
}

export async function getCard(
  gameSlug: string,
  name: string,
  set?: string,
  collectorNumber?: string
): Promise<TcgCard | null> {
  return getProvider(gameSlug).getCard(name, set, collectorNumber);
}

export async function fuzzySearchCard(gameSlug: string, name: string): Promise<TcgCard | null> {
  return getProvider(gameSlug).fuzzySearchCard(name);
}

export async function getCardsByIdentifiers(
  gameSlug: string,
  identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>
): Promise<TcgCard[]> {
  return getProvider(gameSlug).getCardsByIdentifiers(identifiers);
}

export async function getAllPrintings(gameSlug: string, cardName: string): Promise<TcgPrinting[]> {
  return getProvider(gameSlug).getAllPrintings(cardName);
}

export async function resolveCards(
  gameSlug: string,
  parsedCards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>
): Promise<Array<{ name: string; qty: number; imageUrl: string | null; manaCost: string | null; prices?: Record<string, string | null> }>> {
  const identifiers = parsedCards.map((c) => ({
    name: c.name,
    set: c.set,
    collectorNumber: c.collector_number
  }));

  const cards = await getCardsByIdentifiers(gameSlug, identifiers);

  return parsedCards.map((parsed) => {
    const found = cards.find((c) => c.normalizedName === getProvider(gameSlug).normalizeName(parsed.name));
    if (found) {
      return {
        name: parsed.name,
        qty: parsed.qty,
        imageUrl: found.imageUrl,
        manaCost: found.manaCost,
        prices: found.prices as Record<string, string | null>
      };
    }
    return {
      name: parsed.name,
      qty: parsed.qty,
      imageUrl: null,
      manaCost: null
    };
  });
}

// Cache prices in the database to reduce external API calls
export async function getCachedPrices(gameSlug: string, cardName: string): Promise<TcgCard['prices'] | null> {
  const normalizedName = getProvider(gameSlug).normalizeName(cardName);

  const { data } = await supabase
    .from('cards')
    .select('card_printings(market_price_usd, market_price_eur)')
    .eq('normalized_name', normalizedName)
    .maybeSingle();

  if (data?.card_printings?.[0]) {
    const p = data.card_printings[0] as { market_price_usd: number | null; market_price_eur: number | null };
    return {
      usd: p.market_price_usd?.toFixed(2) || null,
      usdFoil: null,
      eur: p.market_price_eur?.toFixed(2) || null,
      eurFoil: null
    };
  }

  return null;
}

export async function updateCachedPrices(
  gameSlug: string,
  cards: Array<{ name: string; prices: Record<string, string | null>; setCode?: string }>
) {
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .single();

  if (!game) return;

  for (const card of cards) {
    const normalizedName = getProvider(gameSlug).normalizeName(card.name);

    const { data: existing } = await supabase
      .from('cards')
      .select('id')
      .eq('normalized_name', normalizedName)
      .eq('game_id', game.id)
      .maybeSingle();

    if (existing && card.setCode) {
      await supabase
        .from('card_printings')
        .update({
          market_price_usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
          market_price_eur: card.prices.eur ? parseFloat(card.prices.eur) : null,
          last_price_update: new Date().toISOString()
        })
        .eq('card_id', existing.id)
        .eq('set_code', card.setCode);
    }
  }
}
