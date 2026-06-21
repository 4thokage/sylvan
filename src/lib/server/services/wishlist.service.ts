import { nanoid } from 'nanoid';
import type { WishlistRepository } from '$lib/server/repositories/types';
import { wishlistRepository as defaultRepo } from '$lib/server/repositories/wishlist.repository';

export async function createWishlist(
  data: {
    cards: Array<{ name: string; qty: number; imageUrl?: string | null; manaCost?: string | null; oracleId?: string | null; selectedPrintIndex?: number | null }>;
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
        card_name: card.name,
        quantity: card.qty
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
