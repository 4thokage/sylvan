import { nanoid } from 'nanoid';
import type { WishlistRepository } from '$lib/server/repositories/types';
import { wishlistRepository as defaultRepo } from '$lib/server/repositories/wishlist.repository';

export async function createWishlist(
	data: {
		cards: Array<{
			card_id: string;
			qty: number;
			card_printing_id?: string | null;
			condition?: string;
			is_foil?: boolean;
			is_signed?: boolean;
			is_altered?: boolean;
			language?: string;
		}>;
		creatorFingerprint?: string;
		ownerName?: string | null;
		clerkUserId?: string | null;
		gameSlug?: string;
	},
	repo?: WishlistRepository
) {
	const r = repo || defaultRepo;
	const id = nanoid(10);

	let userId: string | null = null;
	if (data.clerkUserId) {
		userId = await r.getUserIdByClerkId(data.clerkUserId);
	}

	let gameId: string | null = null;
	if (data.gameSlug) {
		gameId = await r.getGameId(data.gameSlug);
	}

	await r.createWishlist({
		id,
		user_id: userId,
		game_id: gameId,
		owner_name: data.ownerName || null,
		creator_fingerprint: data.creatorFingerprint || null
	});

	if (data.cards.length > 0) {
		await r.createWishlistItems(
			data.cards.map((card) => ({
				wishlist_id: id,
				card_id: card.card_id,
				card_printing_id: card.card_printing_id || null,
				quantity: card.qty,
				condition: card.condition || 'NM',
				is_foil: card.is_foil || false,
				is_signed: card.is_signed || false,
				is_altered: card.is_altered || false,
				language: card.language || 'en'
			}))
		);
	}

	return id;
}

export async function getWishlist(id: string, repo?: WishlistRepository) {
	const r = repo || defaultRepo;
	const result = await r.getWishlist(id);

	if (!result.wishlist) return null;

	return {
		...result.wishlist,
		cards: result.items || []
	};
}

export async function deleteWishlist(
	id: string,
	fingerprint?: string,
	clerkUserId?: string,
	repo?: WishlistRepository
) {
	const r = repo || defaultRepo;

	if (clerkUserId) {
		const userId = await r.getUserIdByClerkId(clerkUserId);
		if (userId) {
			await r.deleteWishlistByUser(id, userId);
			return;
		}
	}

	if (fingerprint) {
		await r.deleteWishlistByFingerprint(id, fingerprint);
		return;
	}

	throw new Error('Not authorized to delete this wishlist');
}

export async function listPublicWishlists(limit = 100, offset = 0, repo?: WishlistRepository) {
	const r = repo || defaultRepo;
	return r.listPublicWishlists(limit, offset);
}

export async function listUserWishlists(
	clerkUserId: string,
	limit = 50,
	offset = 0,
	repo?: WishlistRepository
) {
	const r = repo || defaultRepo;
	const userId = await r.getUserIdByClerkId(clerkUserId);
	if (!userId) return [];
	return r.listUserWishlists(userId, limit, offset);
}
