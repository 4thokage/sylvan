import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { lookupRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { resolveCards } from '$lib/api/card-service';
import { getSupabase } from '$lib/server/supabase';
import { parseCardList } from '$lib/parser';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const rateCheck = lookupRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const body = await request.json();
		const gameSlug = body.game || 'mtg';

		if (!['mtg', 'pokemon', 'riftbound'].includes(gameSlug)) {
			return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
		}

		let cards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>;

		if (body.text) {
			cards = parseCardList(body.text);
		} else if (body.cards) {
			cards = body.cards;
		} else {
			return json({ success: false, error: { message: 'Provide text or cards' } }, { status: 400 });
		}

		if (cards.length === 0) {
			return json({ success: true, data: { cards: [] } });
		}

		if (cards.length > 500) {
			return json(
				{ success: false, error: { message: 'Too many cards (max 500)' } },
				{ status: 400 }
			);
		}

		const resolved = await resolveCards(gameSlug, cards);

		// Resolve the canonical card identity (cards.id) for any card already in
		// the database, so manual additions group with saved stacks of the same
		// card. Cards not yet imported keep no cardId and fall back to name.
		const refs = resolved.flatMap((c) => c.cardRefs ?? []);
		const cardIdByRef = new Map<string, string>();
		if (refs.length > 0) {
			const { data: refRows } = await getSupabase()
				.from('card_external_refs')
				.select('provider_slug, identifier_type, external_id, card_id')
				.in(
					'external_id',
					refs.map((r) => r.externalId)
				);
			for (const row of (refRows || []) as Array<{
				provider_slug: string;
				identifier_type: string;
				external_id: string;
				card_id: string;
			}>) {
				cardIdByRef.set(
					`${row.provider_slug}:${row.identifier_type}:${row.external_id}`,
					row.card_id
				);
			}
		}

		const cardsOut = resolved.map((c) => {
			const { cardRefs, ...rest } = c;
			for (const ref of cardRefs ?? []) {
				const cardId = cardIdByRef.get(
					`${ref.providerSlug}:${ref.identifierType}:${ref.externalId}`
				);
				if (cardId) return { ...rest, cardId };
			}
			return rest;
		});

		return json({ success: true, data: { cards: cardsOut } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Lookup failed';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
