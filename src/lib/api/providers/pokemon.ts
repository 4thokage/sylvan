import TCGdex, { Query } from '@tcgdex/sdk';
import type { TcgProvider, TcgCard, TcgPrinting, TcgSearchResult } from './types';

const tcgdex = new TCGdex('en');

interface RawCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  set?: { id: string; name: string };
  rarity?: string;
  category?: string;
}

function normalize(rawName: string): string {
  return rawName.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, ' ');
}

function mapCard(raw: any): TcgCard {
  const name = raw.name || '';
  return {
    id: raw.id || '',
    name,
    normalizedName: normalize(name),
    imageUrl: typeof raw.getImageURL === 'function'
      ? raw.getImageURL('high', 'png')
      : raw.image
        ? `https://images.tcgdex.net/${tcgdex.getLang()}/high/${raw.id}.png`
        : null,
    manaCost: null,
    typeLine: raw.category || null,
    oracleId: null,
    setCode: raw.set?.id || (raw.id?.split('-')[0] ?? ''),
    setName: raw.set?.name || '',
    collectorNumber: raw.localId || raw.id?.split('-')[1] || '',
    rarity: raw.rarity || '',
    prices: { usd: null, usdFoil: null, eur: null, eurFoil: null },
    gameSlug: 'pokemon'
  };
}

async function getFullCard(raw: any): Promise<TcgCard> {
  if (typeof raw.getCard === 'function') {
    const full = await raw.getCard();
    return mapCard(full);
  }
  return mapCard(raw);
}

export const pokemonProvider: TcgProvider = {
  gameSlug: 'pokemon',
  gameName: 'Pokémon TCG',

  normalizeName(name: string): string {
    return normalize(name);
  },

  async searchCards(query: string, limit = 25): Promise<TcgSearchResult> {
    const q = Query.create()
      .contains('name', query)
      .sort('set.releaseDate', 'DESC')
      .paginate(1, limit);
    const results = await tcgdex.card.list(q);
    const cards: TcgCard[] = [];
    for (const r of results.slice(0, limit)) {
      const card = await getFullCard(r);
      cards.push(card);
    }
    return { cards, totalCount: results.length, hasMore: false };
  },

  async fuzzySearchCard(name: string): Promise<TcgCard | null> {
    return this.getCard(name);
  },

  async getCard(name: string, set?: string, collectorNumber?: string): Promise<TcgCard | null> {
    if (set && collectorNumber) {
      const id = `${set.toLowerCase()}-${collectorNumber}`;
      const card = await tcgdex.card.get(id);
      if (card) return mapCard(card);
    }
    let q = Query.create().equal('name', name).paginate(1, 1);
    let results = await tcgdex.card.list(q);
    if (results.length === 0) {
      q = Query.create().contains('name', name).paginate(1, 1);
      results = await tcgdex.card.list(q);
    }
    if (results.length === 0) return null;
    return getFullCard(results[0]);
  },

  async getCardsByIdentifiers(identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>): Promise<TcgCard[]> {
    const cards: TcgCard[] = [];
    for (const id of identifiers) {
      const card = await this.getCard(id.name, id.set, id.collectorNumber);
      if (card) cards.push(card);
    }
    return cards;
  },

  async getAllPrintings(cardName: string): Promise<TcgPrinting[]> {
    let q = Query.create().equal('name', cardName).sort('set.releaseDate', 'DESC');
    let results = await tcgdex.card.list(q);
    if (results.length === 0) {
      q = Query.create().contains('name', cardName).sort('set.releaseDate', 'DESC');
      results = await tcgdex.card.list(q);
    }
    const printings: TcgPrinting[] = [];
    for (const r of results) {
      const full = await getFullCard(r);
      const setId = full.setCode;
      printings.push({
        id: full.id,
        setCode: setId,
        setName: full.setName,
        collectorNumber: full.collectorNumber,
        rarity: full.rarity,
        imageUrl: full.imageUrl,
        manaCost: null,
        price: null,
        priceFoil: null,
        releasedAt: null
      });
    }
    return printings;
  }
};
