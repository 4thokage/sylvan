export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type CardFinish = 'non-foil' | 'foil' | 'foil-etched' | 'holo' | 'reverse-holo';

export interface GameRow {
	id: string;
	slug: string;
}

export interface UserRow {
	id: string;
	clerk_user_id: string;
	username: string;
	is_admin: boolean;
	created_at: string;
	updated_at: string;
}

export interface CardRow {
	id: string;
	name: string;
	normalized_name: string;
	image_url: string | null;
	game_id: string;
	game_data: Record<string, unknown>;
}

export interface CardPrintingRow {
	id: string;
	card_id: string;
	game_id: string;
	set_code: string;
	set_name: string;
	collector_number: string | null;
	rarity: string | null;
	language: string;
	finish: string;
	factory_signed: boolean;
	image_url: string | null;
	market_price_usd: number | null;
	market_price_eur: number | null;
	last_price_update: string | null;
}

export interface UserCardRow {
	id: string;
	user_id: string;
	card_printing_id: string;
	quantity: number;
	condition: CardCondition;
	aftermarket_signed: boolean;
	is_altered: boolean;
	is_tradeable: boolean;
	location: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface WishlistRow {
	id: string;
	user_id: string | null;
	game_id: string | null;
	title: string | null;
	owner_name: string | null;
	username: string | null;
	creator_fingerprint: string | null;
	visibility: string;
	created_at: string;
	updated_at: string;
}

export interface WishlistItemRow {
	id: string;
	wishlist_id: string;
	card_id: string;
	card_printing_id: string | null;
	quantity: number;
	condition: CardCondition | null;
	finish: string | null;
	aftermarket_signed: boolean | null;
	is_altered: boolean | null;
	language: string | null;
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
	updated_at: string;
}

export interface TradeWithProfiles extends TradeRow {
	proposer: { id: string; username: string | null } | null;
	recipient: { id: string; username: string | null } | null;
}

export interface TradeOfferRow {
	id: string;
	trade_id: string;
	offered_by: string;
	note: string | null;
	created_at: string;
}

export interface TradeOfferItemRow {
	id: string;
	offer_id: string;
	user_card_id: string;
	quantity: number;
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
			condition: CardCondition;
			aftermarket_signed: boolean;
			is_altered: boolean;
			is_tradeable: boolean;
			location: string | null;
			notes: string | null;
		}>,
		gameSlug?: string
	): Promise<{ errors: string[] }>;
	replaceCollection(
		userId: string,
		cards: Array<{
			card_printing_id: string;
			quantity: number;
			condition: CardCondition;
			aftermarket_signed: boolean;
			is_altered: boolean;
			is_tradeable: boolean;
			location: string | null;
			notes: string | null;
		}>,
		gameSlug?: string
	): Promise<{ errors: string[] }>;
	clearCollection(userId: string, gameSlug?: string): Promise<void>;
}

export interface TradeRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	getPublicWishlists(limit?: number, offset?: number): Promise<Array<WishlistRow>>;
	getWishlistItems(wishlistIds: string[]): Promise<WishlistItemRow[]>;
	getWishlistItemsByCardIds(cardIds: string[]): Promise<WishlistItemRow[]>;
	getCardIdsByPrintingIds(printingIds: string[]): Promise<Array<{ id: string; card_id: string }>>;
	getCardPrintingPrices(cardIds: string[]): Promise<Array<{ cardId: string; price: number }>>;
	getTradeById(tradeId: string): Promise<TradeRow | null>;
	getTradesForUser(userDbId: string, limit?: number): Promise<TradeWithProfiles[]>;
	getTradeOffers(tradeId: string): Promise<TradeOfferRow[]>;
	getTradeOfferItems(offerId: string): Promise<TradeOfferItemRow[]>;
	getBlockedUserIds(blockerId: string): Promise<string[]>;
	getUsersBlocking(blockedId: string): Promise<string[]>;
}

export interface WishlistRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	getGameId(gameSlug: string): Promise<string | null>;
	createWishlist(wishlist: {
		id: string;
		user_id: string | null;
		game_id: string | null;
		title: string | null;
		owner_name: string | null;
		creator_fingerprint: string | null;
		visibility: string;
		items: Array<{
			card_id: string;
			card_printing_id?: string | null;
			quantity: number;
			condition?: CardCondition | null;
			finish?: string | null;
			aftermarket_signed?: boolean | null;
			is_altered?: boolean | null;
			language?: string | null;
		}>;
	}): Promise<void>;
	getWishlist(id: string): Promise<{ wishlist: WishlistRow | null; items: WishlistItemRow[] }>;
	deleteWishlistByUser(id: string, userId: string): Promise<void>;
	deleteWishlistByFingerprint(id: string, fingerprint: string): Promise<void>;
	getWishlistFingerprint(id: string): Promise<string | null>;
	listPublicWishlists(limit?: number, offset?: number): Promise<Array<WishlistRow>>;
	listUserWishlists(userId: string, limit?: number, offset?: number): Promise<Array<WishlistRow>>;
}

export interface UserRepository {
	getUserIdByClerkId(clerkUserId: string): Promise<string | null>;
	ensureUser(clerkUserId: string): Promise<UserRow>;
	getUserProfile(clerkUserId: string): Promise<UserRow | null>;
	updateProfile(clerkUserId: string, updates: Record<string, unknown>): Promise<UserRow | null>;
}
