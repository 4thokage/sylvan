import type { CollectionRepository, UserCardRow } from '../types';

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
			let result = cards.filter((c) => c.user_id === userId);
			if (gameSlug) {
				const gameId = await this.getGameId(gameSlug);
				result = result.filter((c) => c.game_id === gameId);
			}
			return result as any;
		},

		async getPublicCollection(userId: string, gameSlug?: string) {
			let result = cards.filter((c) => c.user_id === userId);
			if (gameSlug) {
				const gameId = await this.getGameId(gameSlug);
				result = result.filter((c) => c.game_id === gameId);
			}
			return result as any;
		},

		async saveCollection(userId, incomingCards, gameSlug = 'mtg') {
			const gameId = await this.getGameId(gameSlug);
			const errors: string[] = [];

			for (const incoming of incomingCards) {
				const key = incoming.card_printing_id;
				const existing = cards.find(
					(c) => c.user_id === userId && c.game_id === gameId && c.card_printing_id === key
				);

				if (existing) {
					existing.quantity = (existing.quantity as number) + incoming.quantity;
					existing.updated_at = new Date().toISOString();
				} else {
					cards.push({
						id: `card-${nextId++}`,
						user_id: userId,
						game_id: gameId,
						card_printing_id: incoming.card_printing_id,
						quantity: incoming.quantity,
						condition: incoming.condition || 'NM',
						is_foil: incoming.is_foil || false,
						is_signed: incoming.is_signed || false,
						is_altered: incoming.is_altered || false,
						language: incoming.language || 'en',
						is_tradeable: incoming.is_tradeable !== undefined ? incoming.is_tradeable : true,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					});
				}
			}

			return { errors };
		},

		async replaceCollection(userId, incomingCards, gameSlug = 'mtg') {
			const gameId = await this.getGameId(gameSlug);

			const toRemove = cards.filter((c) => c.user_id === userId && c.game_id === gameId);
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
					card_printing_id: c.card_printing_id,
					quantity: c.quantity,
					condition: c.condition || 'NM',
					is_foil: c.is_foil || false,
					is_signed: c.is_signed || false,
					is_altered: c.is_altered || false,
					language: c.language || 'en',
					is_tradeable: c.is_tradeable !== undefined ? c.is_tradeable : true,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				});
			}

			return { errors: [] };
		},

		async clearCollection(userId, gameSlug?) {
			const toRemove = cards.filter((c) => {
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
