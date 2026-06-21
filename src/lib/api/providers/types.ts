export interface TcgCard {
  id: string;
  name: string;
  normalizedName: string;
  imageUrl: string | null;
  manaCost: string | null;
  typeLine: string | null;
  oracleId: string | null;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  prices: {
    usd: string | null;
    usdFoil: string | null;
    eur: string | null;
    eurFoil: string | null;
  };
  gameSlug: string;
}

export interface TcgPrinting {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  imageUrl: string | null;
  manaCost: string | null;
  price: string | null;
  priceFoil: string | null;
  releasedAt: string | null;
}

export interface TcgSearchResult {
  cards: TcgCard[];
  totalCount: number;
  hasMore: boolean;
}

export interface TcgProvider {
  gameSlug: string;
  gameName: string;

  searchCards(query: string, limit?: number): Promise<TcgSearchResult>;
  getCard(name: string, set?: string, collectorNumber?: string): Promise<TcgCard | null>;
  fuzzySearchCard(name: string): Promise<TcgCard | null>;
  getCardsByIdentifiers(identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>): Promise<TcgCard[]>;
  getAllPrintings(cardName: string): Promise<TcgPrinting[]>;
  normalizeName(name: string): string;
}
