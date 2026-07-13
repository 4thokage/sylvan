import { getSupabase } from '$lib/server/supabase';
import type { CollectionRepository, UserCardRow } from './types';

export const collectionRepository: CollectionRepository = {
	async getGameId(gameSlug: string): Promise<string> {
		const { data: game } = await getSupabase()
			.from('games')
			.select('id')
			.eq('slug', gameSlug)
			.single();
		if (!game) throw new Error(`Game not found: ${gameSlug}`);
		return game.id;
	},

	async getUserIdByClerkId(clerkUserId: string): Promise<string | null> {
		const { data: user } = await getSupabase()
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async getCollection(userId: string, gameSlug?: string) {
		let query = getSupabase().from('user_cards').select('*').eq('user_id', userId);

		if (gameSlug) {
			const gameId = await this.getGameId(gameSlug);
			query = query
				.select(
					'id, user_id, card_printing_id, quantity, condition, aftermarket_signed, is_altered, is_tradeable, location, notes, created_at, updated_at, card_printings!inner(game_id)'
				)
				.eq('card_printings.game_id', gameId);
		}

		const { data: cards } = await query;
		return (cards || []) as UserCardRow[];
	},

	async getPublicCollection(userId: string, gameSlug?: string) {
		let query = getSupabase().from('user_cards').select('*').eq('user_id', userId);

		if (gameSlug) {
			const gameId = await this.getGameId(gameSlug);
			query = query
				.select(
					'id, user_id, card_printing_id, quantity, condition, aftermarket_signed, is_altered, is_tradeable, location, notes, created_at, updated_at, card_printings!inner(game_id)'
				)
				.eq('card_printings.game_id', gameId);
		}

		const { data: cards } = await query;
		return (cards || []) as UserCardRow[];
	},

	async saveCollection(userId, cards, gameSlug = 'mtg') {
		await this.getGameId(gameSlug);

		const { data: existing } = await getSupabase()
			.from('user_cards')
			.select('id, card_printing_id, condition, aftermarket_signed, is_altered, quantity')
			.eq('user_id', userId);

		const existingMap = new Map<string, { id: string; quantity: number }>();
		for (const card of existing || []) {
			const key = `${card.card_printing_id}|${card.condition}|${card.aftermarket_signed}|${card.is_altered}`;
			existingMap.set(key, { id: card.id, quantity: card.quantity });
		}

		const errors: string[] = [];

		for (const incoming of cards) {
			const key = `${incoming.card_printing_id}|${incoming.condition || 'NM'}|${incoming.aftermarket_signed || false}|${incoming.is_altered || false}`;
			const existing = existingMap.get(key);

			if (existing) {
				const { error } = await getSupabase()
					.from('user_cards')
					.update({
						quantity: existing.quantity + incoming.quantity,
						updated_at: new Date().toISOString()
					})
					.eq('id', existing.id);

				if (error) errors.push(error.message);
				existingMap.delete(key);
			} else {
				const { error } = await getSupabase()
					.from('user_cards')
					.insert({
						user_id: userId,
						card_printing_id: incoming.card_printing_id,
						quantity: incoming.quantity,
						condition: incoming.condition || 'NM',
						aftermarket_signed: incoming.aftermarket_signed || false,
						is_altered: incoming.is_altered || false,
						is_tradeable: incoming.is_tradeable !== undefined ? incoming.is_tradeable : true,
						location: incoming.location || null,
						notes: incoming.notes || null
					});

				if (error) errors.push(error.message);
			}
		}

		return { errors };
	},

	async replaceCollection(userId, cards, gameSlug = 'mtg') {
		const gameId = await this.getGameId(gameSlug);

		// Delete existing stacks for this game. We identify the game via the printing join.
		const { data: stacksToDelete } = await getSupabase()
			.from('user_cards')
			.select('id, card_printings!inner(game_id)')
			.eq('user_id', userId)
			.eq('card_printings.game_id', gameId);

		const idsToDelete = (stacksToDelete || []).map((s) => s.id);
		if (idsToDelete.length > 0) {
			await getSupabase().from('user_cards').delete().in('id', idsToDelete);
		}

		if (cards.length === 0) return { errors: [] };

		const { error } = await getSupabase()
			.from('user_cards')
			.insert(
				cards.map((c) => ({
					user_id: userId,
					card_printing_id: c.card_printing_id,
					quantity: c.quantity,
					condition: c.condition || 'NM',
					aftermarket_signed: c.aftermarket_signed || false,
					is_altered: c.is_altered || false,
					is_tradeable: c.is_tradeable !== undefined ? c.is_tradeable : true,
					location: c.location || null,
					notes: c.notes || null
				}))
			);

		return { errors: error ? [error.message] : [] };
	},

	async clearCollection(userId, gameSlug?) {
		if (gameSlug) {
			const gameId = await this.getGameId(gameSlug);
			const { data: stacksToDelete } = await getSupabase()
				.from('user_cards')
				.select('id, card_printings!inner(game_id)')
				.eq('user_id', userId)
				.eq('card_printings.game_id', gameId);

			const idsToDelete = (stacksToDelete || []).map((s) => s.id);
			if (idsToDelete.length > 0) {
				await getSupabase().from('user_cards').delete().in('id', idsToDelete);
			}
		} else {
			await getSupabase().from('user_cards').delete().eq('user_id', userId);
		}
	}
};
