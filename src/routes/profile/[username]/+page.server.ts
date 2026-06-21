import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

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
    .select('card_name, quantity, image_url, condition, is_foil')
    .eq('user_id', user.id)
    .eq('is_public', true)
    .limit(100);

  const totalCards = (cards || []).reduce((sum, c) => sum + c.quantity, 0);

  return {
    profile: user,
    collection: {
      cards: cards || [],
      totalCards,
      uniqueCards: cards?.length || 0
    }
  };
};
