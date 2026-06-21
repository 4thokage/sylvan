import { supabase } from '$lib/server/supabase';
import type { TcgCard } from '$lib/api/providers/types';
import { getProvider } from '$lib/api/card-service';

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
