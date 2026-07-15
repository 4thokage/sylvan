import type { PageServerLoad } from './$types';
import { getCollection } from '$lib/server/services/collection.service';

const GAMES = ['mtg', 'pokemon', 'riftbound'];

export const load: PageServerLoad = async ({ locals }) => {
	const auth = await locals.auth();
	if (!auth.userId) {
		return { signedIn: false, lists: [] as never[] };
	}

	const lists: Array<{
		game: string;
		cards: Array<{
			name: string;
			qty: number;
			marketPriceUsd: number | null;
			marketPriceEur: number | null;
		}>;
	}> = [];

	for (const game of GAMES) {
		const cards = await getCollection(auth.userId, game);
		if (cards.length > 0) {
			lists.push({
				game,
				cards: cards.map((c) => ({
					name: c.cardName,
					qty: c.quantity,
					marketPriceUsd: c.marketPriceUsd,
					marketPriceEur: c.marketPriceEur
				}))
			});
		}
	}

	return { signedIn: true, lists };
};
