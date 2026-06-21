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
	user_id: string;
	card_printing_id: string;
	game_id: string;
	quantity: number;
	condition: string;
	is_foil: boolean;
	is_signed: boolean;
	is_altered: boolean;
	language: string;
	is_tradeable: boolean;
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
	card_id: string;
	card_printing_id: string | null;
	quantity: number;
	condition: string;
	is_foil: boolean;
	is_signed: boolean;
	is_altered: boolean;
	language: string;
}

export interface TradeRow {
	id: string;
	proposer_id: string;
	recipient_id: string;
	status: string;
	current_offer_id: string | null;
	proposer_note: string | null;
	recipient_note: string | null;
	completed_at: string | null;
	created_at: string;
}

export interface TradeWithProfiles extends TradeRow {
	proposer: { id: string; display_name: string | null; username: string | null } | null;
	recipient: { id: string; display_name: string | null; username: string | null } | null;
}

export interface TradeOfferRow {
	id: string;
	trade_id: string;
	offered_by: string;
	created_at: string;
}

export interface TradeOfferItemRow {
	id: string;
	offer_id: string;
	user_card_id: string;
	side: string;
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
	saveCollection(
		userId: string,
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
		gameSlug?: string
	): Promise<{ errors: string[] }>;
	replaceCollection(
		userId: string,
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
		gameSlug?: string
	): Promise<{ errors: string[] }>;
	clearCollection(userId: string, gameSlug?: string): Promise<void>;
}

export interface TradeRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	getPublicWishlists(limit?: number, offset?: number): Promise<Array<WishlistRow>>;
	getWishlistItems(wishlistIds: string[]): Promise<WishlistItemRow[]>;
	getCardPrintingPrices(cardIds: string[]): Promise<Array<{ cardId: string; price: number }>>;
	createTrade(trade: {
		proposer_id: string;
		recipient_id: string;
		proposer_note?: string | null;
	}): Promise<TradeRow>;
	getTradeById(tradeId: string): Promise<TradeRow | null>;
	getTradesForUser(userDbId: string, limit?: number): Promise<TradeWithProfiles[]>;
	updateTradeStatus(tradeId: string, status: string, completedAt?: string): Promise<void>;
	updateCurrentOffer(tradeId: string, offerId: string): Promise<void>;
	createTradeOffer(offer: { trade_id: string; offered_by: string }): Promise<TradeOfferRow>;
	createTradeOfferItems(
		items: Array<{ offer_id: string; user_card_id: string; side: string }>
	): Promise<void>;
	getTradeOffers(tradeId: string): Promise<TradeOfferRow[]>;
	getTradeOfferItems(offerId: string): Promise<TradeOfferItemRow[]>;
	getBlockedUserIds(blockerId: string): Promise<string[]>;
}

export interface WishlistRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	getGameId(gameSlug: string): Promise<string | null>;
	createWishlist(wishlist: {
		id: string;
		user_id: string | null;
		game_id: string | null;
		owner_name: string | null;
		creator_fingerprint: string | null;
	}): Promise<void>;
	createWishlistItems(
		items: Array<{
			wishlist_id: string;
			card_id: string;
			card_printing_id?: string | null;
			quantity: number;
			condition?: string;
			is_foil?: boolean;
			is_signed?: boolean;
			is_altered?: boolean;
			language?: string;
		}>
	): Promise<void>;
	getWishlist(id: string): Promise<{ wishlist: WishlistRow | null; items: WishlistItemRow[] }>;
	deleteWishlistByUser(id: string, userId: string): Promise<void>;
	deleteWishlistByFingerprint(id: string, fingerprint: string): Promise<void>;
	getWishlistFingerprint(id: string): Promise<string | null>;
	listPublicWishlists(limit?: number, offset?: number): Promise<Array<WishlistRow>>;
}

export interface UserRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	ensureUser(clerkUserId: string): Promise<UserRow>;
	getUserProfile(clerkUserId: string): Promise<UserRow | null>;
	getPublicProfile(userId: string): Promise<Partial<UserRow> | null>;
	updateProfile(clerkUserId: string, updates: Record<string, unknown>): Promise<UserRow | null>;
}
