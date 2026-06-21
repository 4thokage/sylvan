import type { CollectionRepository, UserCardRow } from '$lib/server/repositories/types';
import { collectionRepository as defaultRepo } from '$lib/server/repositories/collection.repository';

export interface CollectionCard {
  id: string;
  cardName: string;
  imageUrl: string | null;
  quantity: number;
  condition: string;
  isFoil: boolean;
  isSigned: boolean;
  isAltered: boolean;
  language: string;
  isCustom: boolean;
  customImageUrl: string | null;
  userPriceOverride: number | null;
  notes: string | null;
  isPublic: boolean;
  gameSlug: string | null;
}

function mapCard(c: UserCardRow): CollectionCard {
  return {
    id: c.id,
    cardName: c.card_name,
    imageUrl: c.image_url,
    quantity: c.quantity,
    condition: c.condition,
    isFoil: c.is_foil,
    isSigned: c.is_signed,
    isAltered: c.is_altered,
    language: c.language,
    isCustom: c.is_custom,
    customImageUrl: c.custom_image_url,
    userPriceOverride: c.user_price_override,
    notes: c.notes,
    isPublic: c.is_public,
    gameSlug: null
  };
}

export async function getCollection(userId: string, gameSlug?: string, repo?: CollectionRepository) {
  const r = repo || defaultRepo;
  const cards = await r.getCollection(userId, gameSlug);
  return cards.map(mapCard);
}

export async function getPublicCollection(userId: string, gameSlug?: string, repo?: CollectionRepository) {
  const r = repo || defaultRepo;
  const cards = await r.getPublicCollection(userId, gameSlug);
  return cards.map(mapCard);
}

export async function saveCollection(
  clerkUserId: string,
  cards: Array<{ name: string; qty: number }>,
  gameSlug = 'mtg',
  repo?: CollectionRepository
) {
  const r = repo || defaultRepo;
  return r.saveCollection(clerkUserId, cards, gameSlug);
}

export async function saveAnonymousCollection(
  fingerprint: string,
  cards: Array<{ name: string; qty: number }>,
  gameSlug = 'mtg',
  repo?: CollectionRepository
) {
  const r = repo || defaultRepo;
  return r.saveAnonymousCollection(fingerprint, cards, gameSlug);
}

export async function replaceCollection(
  clerkUserId: string,
  cards: Array<{ name: string; qty: number }>,
  gameSlug = 'mtg',
  repo?: CollectionRepository
) {
  const r = repo || defaultRepo;
  return r.replaceCollection(clerkUserId, cards, gameSlug);
}

export async function clearCollection(clerkUserId: string, gameSlug?: string, repo?: CollectionRepository) {
  const r = repo || defaultRepo;
  return r.clearCollection(clerkUserId, gameSlug);
}
