import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const { data: wishlist, error } = await supabase
		.from('wishlists')
		.select('*')
		.eq('id', params.id)
		.single();

	if (error || !wishlist) {
		throw new Error('Wishlist not found');
	}

	return { wishlist };
};
