import type { CollectionRepository } from '../types';

export function createInMemoryCollectionRepository(): CollectionRepository {
  const users = new Map<string, string>();
  const games = new Map<string, string>();
  const cards: Array<Record<string, unknown>> = [];
  let nextId = 1;

  return {
    async getGameId(gameSlug: string) {
      if (!games.has(gameSlug)) {
        games.set(gameSlug, `game-${nextId++}`);
      }
      return games.get(gameSlug)!;
    },

    async getUserIdByClerkId(clerkUserId: string) {
      return users.get(clerkUserId) || null;
    },

    async getCollection(userId: string, gameSlug?: string) {
      let result = cards.filter(c => c.user_id === userId);
      if (gameSlug) {
        const gameId = await this.getGameId(gameSlug);
        result = result.filter(c => c.game_id === gameId);
      }
      return result as any;
    },

    async getPublicCollection(userId: string, gameSlug?: string) {
      let result = cards.filter(c => c.user_id === userId && c.is_public === true);
      if (gameSlug) {
        const gameId = await this.getGameId(gameSlug);
        result = result.filter(c => c.game_id === gameId);
      }
      return result as any;
    },

    async saveCollection(clerkUserId, incomingCards, gameSlug = 'mtg') {
      let userId = users.get(clerkUserId);
      if (!userId) {
        userId = `user-${nextId++}`;
        users.set(clerkUserId, userId);
      }

      const gameId = await this.getGameId(gameSlug);
      const errors: string[] = [];

      for (const incoming of incomingCards) {
        const key = incoming.name.toLowerCase();
        const existing = cards.find(c => c.user_id === userId && c.game_id === gameId && (c.card_name as string).toLowerCase() === key);

        if (existing) {
          existing.quantity = (existing.quantity as number) + incoming.qty;
          existing.updated_at = new Date().toISOString();
        } else {
          cards.push({
            id: `card-${nextId++}`,
            user_id: userId,
            game_id: gameId,
            card_name: incoming.name,
            quantity: incoming.qty,
            is_public: true,
            condition: '',
            is_foil: false,
            is_signed: false,
            is_altered: false,
            language: 'en',
            is_custom: false,
            custom_image_url: null,
            user_price_override: null,
            notes: null,
            image_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      return { errors };
    },

    async saveAnonymousCollection(fingerprint, incomingCards, gameSlug = 'mtg') {
      const errors: string[] = [];
      const gameId = await this.getGameId(gameSlug);

      for (const incoming of incomingCards) {
        cards.push({
          id: `card-${nextId++}`,
          session_fingerprint: fingerprint,
          game_id: gameId,
          card_name: incoming.name,
          quantity: incoming.qty,
          is_public: true
        });
      }

      return { errors };
    },

    async replaceCollection(clerkUserId, incomingCards, gameSlug = 'mtg') {
      let userId = users.get(clerkUserId);
      if (!userId) throw new Error('User not found');

      const gameId = await this.getGameId(gameSlug);

      const toRemove = cards.filter(c => c.user_id === userId && c.game_id === gameId);
      for (const c of toRemove) {
        const idx = cards.indexOf(c);
        if (idx >= 0) cards.splice(idx, 1);
      }

      if (incomingCards.length === 0) return { errors: [] };

      for (const c of incomingCards) {
        cards.push({
          id: `card-${nextId++}`,
          user_id: userId,
          game_id: gameId,
          card_name: c.name,
          quantity: c.qty,
          is_public: true
        });
      }

      return { errors: [] };
    },

    async clearCollection(clerkUserId, gameSlug?) {
      const userId = users.get(clerkUserId);
      if (!userId) return;

      const toRemove = cards.filter(c => {
        if (c.user_id !== userId) return false;
        if (gameSlug) {
          const gameId = games.get(gameSlug);
          return c.game_id === gameId;
        }
        return true;
      });

      for (const c of toRemove) {
        const idx = cards.indexOf(c);
        if (idx >= 0) cards.splice(idx, 1);
      }
    }
  };
}
