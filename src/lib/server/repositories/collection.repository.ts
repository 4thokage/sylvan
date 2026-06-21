import { supabase } from '$lib/server/supabase';
import type { CollectionRepository, UserCardRow } from './types';

export const collectionRepository: CollectionRepository = {
  async getGameId(gameSlug: string): Promise<string> {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', gameSlug)
      .single();
    if (!game) throw new Error(`Game not found: ${gameSlug}`);
    return game.id;
  },

  async getUserIdByClerkId(clerkUserId: string): Promise<string | null> {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single();
    return user?.id || null;
  },

  async getCollection(userId: string, gameSlug?: string) {
    let query = supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId);

    if (gameSlug) {
      const gameId = await this.getGameId(gameSlug);
      query = query.eq('game_id', gameId);
    }

    const { data: cards } = await query;
    return (cards || []) as UserCardRow[];
  },

  async getPublicCollection(userId: string, gameSlug?: string) {
    let query = supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_public', true);

    if (gameSlug) {
      const gameId = await this.getGameId(gameSlug);
      query = query.eq('game_id', gameId);
    }

    const { data: cards } = await query;
    return (cards || []) as UserCardRow[];
  },

  async saveCollection(clerkUserId, cards, gameSlug = 'mtg') {
    const userId = await this.getUserIdByClerkId(clerkUserId);
    if (!userId) throw new Error('User not found');

    const gameId = await this.getGameId(gameSlug);

    const { data: existing } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('game_id', gameId);

    const existingMap = new Map<string, { id: string; quantity: number }>();
    for (const card of existing || []) {
      const key = card.card_name.toLowerCase();
      existingMap.set(key, { id: card.id, quantity: card.quantity });
    }

    const errors: string[] = [];

    for (const incoming of cards) {
      const key = incoming.name.toLowerCase();
      const existing = existingMap.get(key);

      if (existing) {
        const { error } = await supabase
          .from('user_cards')
          .update({ quantity: existing.quantity + incoming.qty, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) errors.push(error.message);
        existingMap.delete(key);
      } else {
        const { error } = await supabase.from('user_cards').insert({
          user_id: userId,
          game_id: gameId,
          card_name: incoming.name,
          quantity: incoming.qty,
          is_public: true
        });

        if (error) errors.push(error.message);
      }
    }

    return { errors };
  },

  async saveAnonymousCollection(fingerprint, cards, gameSlug = 'mtg') {
    const errors: string[] = [];
    const gameId = await this.getGameId(gameSlug);

    for (const incoming of cards) {
      const { error } = await supabase.from('user_cards').insert({
        session_fingerprint: fingerprint,
        game_id: gameId,
        card_name: incoming.name,
        quantity: incoming.qty,
        is_public: true
      });
      if (error) errors.push(error.message);
    }

    return { errors };
  },

  async replaceCollection(clerkUserId, cards, gameSlug = 'mtg') {
    const userId = await this.getUserIdByClerkId(clerkUserId);
    if (!userId) throw new Error('User not found');

    const gameId = await this.getGameId(gameSlug);

    await supabase.from('user_cards').delete().eq('user_id', userId).eq('game_id', gameId);

    if (cards.length === 0) return { errors: [] };

    const { error } = await supabase.from('user_cards').insert(
      cards.map((c) => ({
        user_id: userId,
        game_id: gameId,
        card_name: c.name,
        quantity: c.qty,
        is_public: true
      }))
    );

    return { errors: error ? [error.message] : [] };
  },

  async clearCollection(clerkUserId, gameSlug?) {
    const userId = await this.getUserIdByClerkId(clerkUserId);
    if (!userId) return;

    let query = supabase.from('user_cards').delete().eq('user_id', userId);
    if (gameSlug) {
      const gameId = await this.getGameId(gameSlug);
      query = query.eq('game_id', gameId);
    }
    await query;
  }
};
