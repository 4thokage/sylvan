import { supabase } from '$lib/server/supabase';
import type { CollectionRepository, UserCardRow } from './types';

export const collectionRepository: CollectionRepository = {
	async getGameId(gameSlug: string): Promise<string> {
		const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();
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
		let query = supabase.from('user_cards').select('*').eq('user_id', userId);

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
			.select('*, users!inner(is_public)')
			.eq('user_id', userId)
			.eq('users.is_public', true);

		if (gameSlug) {
			const gameId = await this.getGameId(gameSlug);
			query = query.eq('game_id', gameId);
		}

		const { data: cards } = await query;
		return (cards || []) as UserCardRow[];
	},

	async saveCollection(userId, cards, gameSlug = 'mtg') {
		const gameId = await this.getGameId(gameSlug);

		const { data: existing } = await supabase
			.from('user_cards')
			.select('id, card_printing_id, quantity')
			.eq('user_id', userId)
			.eq('game_id', gameId);

		const existingMap = new Map<string, { id: string; quantity: number }>();
		for (const card of existing || []) {
			existingMap.set(card.card_printing_id, { id: card.id, quantity: card.quantity });
		}

		const errors: string[] = [];

		for (const incoming of cards) {
			const key = incoming.card_printing_id;
			const existing = existingMap.get(key);

			if (existing) {
				const { error } = await supabase
					.from('user_cards')
					.update({
						quantity: existing.quantity + incoming.quantity,
						updated_at: new Date().toISOString()
					})
					.eq('id', existing.id);

				if (error) errors.push(error.message);
				existingMap.delete(key);
			} else {
				const { error } = await supabase.from('user_cards').insert({
					user_id: userId,
					game_id: gameId,
					card_printing_id: incoming.card_printing_id,
					quantity: incoming.quantity,
					condition: incoming.condition || 'NM',
					is_foil: incoming.is_foil || false,
					is_signed: incoming.is_signed || false,
					is_altered: incoming.is_altered || false,
					language: incoming.language || 'en',
					is_tradeable: incoming.is_tradeable !== undefined ? incoming.is_tradeable : true
				});

				if (error) errors.push(error.message);
			}
		}

		return { errors };
	},

	async replaceCollection(userId, cards, gameSlug = 'mtg') {
		const gameId = await this.getGameId(gameSlug);

		await supabase.from('user_cards').delete().eq('user_id', userId).eq('game_id', gameId);

		if (cards.length === 0) return { errors: [] };

		const { error } = await supabase.from('user_cards').insert(
			cards.map((c) => ({
				user_id: userId,
				game_id: gameId,
				card_printing_id: c.card_printing_id,
				quantity: c.quantity,
				condition: c.condition || 'NM',
				is_foil: c.is_foil || false,
				is_signed: c.is_signed || false,
				is_altered: c.is_altered || false,
				language: c.language || 'en',
				is_tradeable: c.is_tradeable !== undefined ? c.is_tradeable : true
			}))
		);

		return { errors: error ? [error.message] : [] };
	},

	async clearCollection(userId, gameSlug?) {
		let query = supabase.from('user_cards').delete().eq('user_id', userId);
		if (gameSlug) {
			const gameId = await this.getGameId(gameSlug);
			query = query.eq('game_id', gameId);
		}
		await query;
	}
};
