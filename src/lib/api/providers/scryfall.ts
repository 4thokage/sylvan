import type { TcgProvider, TcgCard, TcgPrinting, TcgSearchResult } from './types';

const API_BASE = 'https://api.scryfall.com';
const MAX_BATCH = 75;
const RATE_LIMIT_MS = 100;

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  oracle_id: string | null;
  image_uris: { small: string; normal: string; large: string; png: string; art_crop: string; border_crop: string } | null;
  card_faces?: Array<{ name: string; mana_cost: string | null; image_uris: { small: string; normal: string; large: string; png: string; art_crop: string; border_crop: string } }>;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  prices: { usd: string | null; usd_foil: string | null; eur: string | null; eur_foil: string | null; tix: string | null };
  released_at: string;
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'SylvanApp/1.0 (contact@sylvan.app)'
};

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const scryfallProvider: TcgProvider = {
  gameSlug: 'mtg',
  gameName: 'Magic: The Gathering',

  normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/['"]/g, '').replace(/[-\s]+/g, ' ');
  },

  async searchCards(query: string, limit = 25): Promise<TcgSearchResult> {
    await delay(RATE_LIMIT_MS);
    const response = await fetch(
      `${API_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc`,
      { headers: HEADERS }
    );

    if (response.status === 404) {
      return { cards: [], totalCount: 0, hasMore: false };
    }

    if (!response.ok) {
      throw new Error(`Scryfall search failed: ${response.status}`);
    }

    const data = await response.json();
    const cards = (data.data || []).slice(0, limit).map(mapToTcgCard);

    return { cards, totalCount: data.total_cards || 0, hasMore: data.has_more || false };
  },

  async fuzzySearchCard(name: string): Promise<TcgCard | null> {
    await delay(RATE_LIMIT_MS);
    const url = `${API_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`;

    const response = await fetch(url, { headers: HEADERS });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Scryfall fuzzy lookup failed: ${response.status}`);
    const card = await response.json();
    return mapToTcgCard(card);
  },

  async getCard(name: string, set?: string, collectorNumber?: string): Promise<TcgCard | null> {
    await delay(RATE_LIMIT_MS);
    let url = `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}`;
    if (set && collectorNumber) {
      url = `${API_BASE}/cards/${set.toLowerCase()}/${collectorNumber}`;
    } else if (set) {
      url = `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}&set=${set.toLowerCase()}`;
    }

    const response = await fetch(url, { headers: HEADERS });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Scryfall lookup failed: ${response.status}`);
    const card = await response.json();
    return mapToTcgCard(card);
  },

  async getCardsByIdentifiers(identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>): Promise<TcgCard[]> {
    const allCards: TcgCard[] = [];

    for (let i = 0; i < identifiers.length; i += MAX_BATCH) {
      const batch = identifiers.slice(i, i + MAX_BATCH);
      await delay(RATE_LIMIT_MS);

      const response = await fetch(`${API_BASE}/cards/collection`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          identifiers: batch.map((id) => ({
            name: id.name,
            ...(id.set && { set: id.set.toLowerCase() }),
            ...(id.collectorNumber && { collector_number: id.collectorNumber })
          }))
        })
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limited by Scryfall API');
        throw new Error(`Scryfall collection failed: ${response.status}`);
      }

      const data = await response.json();
      for (const card of data.data || []) {
        allCards.push(mapToTcgCard(card));
      }
    }

    return allCards;
  },

  async getAllPrintings(cardName: string): Promise<TcgPrinting[]> {
    const prints: TcgPrinting[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await delay(RATE_LIMIT_MS);
      const response = await fetch(
        `${API_BASE}/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc&page=${page}`,
        { headers: HEADERS }
      );

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limited by Scryfall API');
        throw new Error(`Scryfall printings failed: ${response.status}`);
      }

      const data = await response.json();
      for (const card of data.data || []) {
        const imageUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null;
        const manaCost = card.mana_cost || card.card_faces?.[0]?.mana_cost || null;
        prints.push({
          id: card.id,
          setCode: card.set,
          setName: card.set_name,
          collectorNumber: card.collector_number,
          rarity: card.rarity,
          imageUrl,
          manaCost,
          price: card.prices?.usd || null,
          priceFoil: card.prices?.usd_foil || null,
          releasedAt: card.released_at || null
        });
      }

      hasMore = data.has_more || false;
      page++;
    }

    return prints;
  }
};

function mapToTcgCard(raw: ScryfallCard): TcgCard {
  const imageUrl = raw.image_uris?.normal || raw.card_faces?.[0]?.image_uris?.normal || null;
  const manaCost = raw.mana_cost || raw.card_faces?.[0]?.mana_cost || null;

  return {
    id: raw.id,
    name: raw.name,
    normalizedName: raw.name.toLowerCase().trim(),
    imageUrl,
    manaCost,
    typeLine: raw.type_line || null,
    oracleId: raw.oracle_id || null,
    setCode: raw.set,
    setName: raw.set_name,
    collectorNumber: raw.collector_number,
    rarity: raw.rarity,
    prices: {
      usd: raw.prices?.usd || null,
      usdFoil: raw.prices?.usd_foil || null,
      eur: raw.prices?.eur || null,
      eurFoil: raw.prices?.eur_foil || null
    },
    gameSlug: 'mtg'
  };
}
