export interface GameRow {
  id: string;
  slug: string;
}

export interface UserRow {
  id: string;
  clerk_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CardRow {
  id: string;
  name: string;
  normalized_name: string;
  image_url: string | null;
  oracle_id: string | null;
  game_id: string;
  game_data: Record<string, unknown>;
}

export interface CardPrintingRow {
  id: string;
  card_id: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  image_url: string | null;
  market_price_usd: number | null;
  market_price_eur: number | null;
  last_price_update: string | null;
}

export interface UserCardRow {
  id: string;
  user_id: string | null;
  session_fingerprint: string | null;
  game_id: string;
  card_name: string;
  quantity: number;
  image_url: string | null;
  condition: string;
  is_foil: boolean;
  is_signed: boolean;
  is_altered: boolean;
  language: string;
  is_custom: boolean;
  custom_image_url: string | null;
  user_price_override: number | null;
  notes: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WishlistRow {
  id: string;
  user_id: string | null;
  game_id: string | null;
  owner_name: string | null;
  creator_fingerprint: string | null;
  visibility: string;
  created_at: string;
}

export interface WishlistItemRow {
  id: string;
  wishlist_id: string;
  card_name: string;
  quantity: number;
}

export interface TradeRow {
  id: string;
  proposer_id: string;
  recipient_id: string;
  status: string;
  proposer_note: string | null;
  recipient_note: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TradeItemRow {
  id: string;
  trade_id: string;
  user_card_id: string;
  side: string;
}

export interface TradeOfferRow {
  id: string;
  trade_id: string;
  offered_by: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface BlockedUserRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface CollectionRepository {
  getGameId(gameSlug: string): Promise<string>;
  getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
  getCollection(userId: string, gameSlug?: string): Promise<UserCardRow[]>;
  getPublicCollection(userId: string, gameSlug?: string): Promise<UserCardRow[]>;
  saveCollection(clerkUserId: string, cards: Array<{ name: string; qty: number }>, gameSlug?: string): Promise<{ errors: string[] }>;
  saveAnonymousCollection(fingerprint: string, cards: Array<{ name: string; qty: number }>, gameSlug?: string): Promise<{ errors: string[] }>;
  replaceCollection(clerkUserId: string, cards: Array<{ name: string; qty: number }>, gameSlug?: string): Promise<{ errors: string[] }>;
  clearCollection(clerkUserId: string, gameSlug?: string): Promise<void>;
}

export interface TradeRepository {
  getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
  getPublicWishlists(limit?: number, offset?: number): Promise<Array<{ id: string; owner_name: string | null; user_id: string | null; created_at: string }>>;
  getWishlistItems(wishlistIds: string[]): Promise<Array<{ wishlist_id: string; card_name: string; quantity: number }>>;
  getCardPrintingPrices(cardNames: string[]): Promise<Array<{ cardName: string; price: number }>>;
  createTrade(trade: { proposer_id: string; recipient_id: string; proposer_note?: string | null }): Promise<TradeRow>;
  createTradeItems(items: Array<{ trade_id: string; user_card_id: string; side: string }>): Promise<void>;
  getTradeById(tradeId: string): Promise<TradeRow | null>;
  getTradesForUser(userDbId: string, limit?: number): Promise<any[]>;
  updateTradeStatus(tradeId: string, status: string, completedAt?: string): Promise<void>;
  createCounterOffer(offer: { trade_id: string; offered_by: string; status?: string; notes?: string | null }): Promise<void>;
  deleteTradeItems(tradeId: string): Promise<void>;
  getBlockedUserIds(blockerId: string): Promise<string[]>;
}

export interface WishlistRepository {
  getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
  getGameId(gameSlug: string): Promise<string | null>;
  createWishlist(wishlist: { id: string; user_id: string | null; game_id: string | null; owner_name: string | null; creator_fingerprint: string | null }): Promise<void>;
  createWishlistItems(items: Array<{ wishlist_id: string; card_name: string; quantity: number }>): Promise<void>;
  getWishlist(id: string): Promise<{ wishlist: WishlistRow | null; items: WishlistItemRow[] }>;
  deleteWishlistByUser(id: string, userId: string): Promise<void>;
  deleteWishlistByFingerprint(id: string, fingerprint: string): Promise<void>;
  getWishlistFingerprint(id: string): Promise<string | null>;
  listPublicWishlists(limit?: number, offset?: number): Promise<Array<{ id: string; owner_name: string | null; user_id: string | null; created_at: string }>>;
}

export interface UserRepository {
  getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
  ensureUser(clerkUserId: string): Promise<UserRow>;
  getUserProfile(clerkUserId: string): Promise<UserRow | null>;
  getPublicProfile(userId: string): Promise<Partial<UserRow> | null>;
  updateProfile(clerkUserId: string, updates: Record<string, unknown>): Promise<UserRow | null>;
}
