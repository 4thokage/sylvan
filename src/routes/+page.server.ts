import type { Actions } from './$types';
import { nanoid } from 'nanoid';
import { supabase } from '$lib/server/supabase';

export const actions = {
	save: async ({ request }) => {
		const data = await request.json();
		const cards = data.cards as Array<{
			name: string;
			qty: number;
			imageUrl: string | null;
			manaCost: string | null;
		}>;

		const id = nanoid(10);

		const { error } = await supabase.from('wishlists').insert({
			id,
			cards: cards,
			created_at: new Date().toISOString()
		});

		if (error) {
			return { success: false, error: { message: error.message } };
		}

		return { success: true, data: { id } };
	}
} satisfies Actions;
