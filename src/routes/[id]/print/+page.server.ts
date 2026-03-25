import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const { data: wishlist, error: dbError } = await supabase
		.from('wishlists')
		.select('*')
		.eq('id', params.id)
		.single();

	if (dbError || !wishlist) {
		throw error(404, 'Wishlist not found');
	}

	return { wishlist };
};
