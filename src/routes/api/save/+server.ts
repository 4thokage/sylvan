import type { RequestHandler } from './$types';
import { nanoid } from 'nanoid';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const auth = await locals.auth();
		const clerkUserId = auth.userId;

		const data = await request.json();
		const cards = data.cards as Array<{
			name: string;
			qty: number;
			imageUrl: string | null;
			manaCost: string | null;
			oracleId?: string;
			selectedPrintIndex?: number;
		}>;
		const creatorFingerprint = data.creatorFingerprint as string | undefined;
		const ownerName = data.ownerName as string | null | undefined;

		const id = nanoid(10);

		const cardsToSave = cards.map((card) => ({
			name: card.name,
			qty: card.qty,
			imageUrl: card.imageUrl,
			manaCost: card.manaCost,
			oracleId: card.oracleId || null,
			selectedPrintIndex: card.selectedPrintIndex ?? null
		}));

		const { error } = await supabase.from('wishlists').insert({
			id,
			cards: cardsToSave,
			created_at: new Date().toISOString(),
			...(creatorFingerprint && { creator_fingerprint: creatorFingerprint }),
			...(ownerName && { owner_name: ownerName }),
			...(clerkUserId && { clerk_user_id: clerkUserId }),
			visibility: 'public'
		});

		if (error) {
			return new Response(JSON.stringify({ success: false, error: { message: error.message } }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(JSON.stringify({ success: true, data: { id } }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to save wishlist';
		return new Response(JSON.stringify({ success: false, error: { message } }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
