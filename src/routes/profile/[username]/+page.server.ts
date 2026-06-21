import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

interface CardRow {
	quantity: number;
	condition: string;
	is_foil: boolean;
	card_printings: Array<{ image_url: string | null; card_id: string }>;
}

interface MappedCard {
	card_name: string;
	image_url: string | null;
	quantity: number;
	is_foil: boolean;
	condition: string;
}

export const load: PageServerLoad = async ({ params }) => {
	const { data: user } = await supabase
		.from('users')
		.select('id, username, display_name, avatar_url, bio, location, created_at')
		.eq('username', params.username)
		.eq('is_public', true)
		.single();

	if (!user) {
		throw error(404, 'User not found or profile is private');
	}

	const { data: cards } = await supabase
		.from('user_cards')
		.select(
			`
			quantity, condition, is_foil,
			card_printings!inner (
				image_url,
				card_id
			)
		`
		)
		.eq('user_id', user.id)
		.limit(100);

	const printingIds = (cards || [])
		.map((c: CardRow) => c.card_printings?.[0]?.card_id)
		.filter((id): id is string => !!id);
	const cardNames = new Map<string, string>();
	if (printingIds.length > 0) {
		const { data: found } = await supabase.from('cards').select('id, name').in('id', printingIds);
		for (const card of (found || []) as Array<{ id: string; name: string }>) {
			cardNames.set(card.id, card.name);
		}
	}

	const mappedCards: MappedCard[] = (cards || []).map((c: CardRow) => {
		const cardId: string = c.card_printings?.[0]?.card_id || '';
		return {
			card_name: cardNames.get(cardId) || 'Unknown',
			image_url: c.card_printings?.[0]?.image_url || null,
			quantity: c.quantity,
			is_foil: c.is_foil,
			condition: c.condition
		};
	});

	const totalCards = mappedCards.reduce((sum: number, c) => sum + c.quantity, 0);

	return {
		profile: user,
		collection: {
			cards: mappedCards,
			totalCards,
			uniqueCards: mappedCards.length
		}
	};
};
