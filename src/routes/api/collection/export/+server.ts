import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getCollection } from '$lib/server/services/collection.service';

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	try {
		const cards = await getCollection(clerkUserId);
		const format = url.searchParams.get('format') || 'json';

		switch (format) {
			case 'csv': {
				const csv =
					'Name,Quantity\n' + cards.map((c) => `"${c.cardName}",${c.quantity}`).join('\n');
				return new Response(csv, {
					headers: {
						'Content-Type': 'text/csv',
						'Content-Disposition': 'attachment; filename="collection.csv"'
					}
				});
			}
			case 'text': {
				const text = cards.map((c) => `${c.quantity} ${c.cardName}`).join('\n');
				return new Response(text, {
					headers: {
						'Content-Type': 'text/plain',
						'Content-Disposition': 'attachment; filename="collection.txt"'
					}
				});
			}
			case 'json':
			default: {
				return json({ success: true, data: { cards } });
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Export failed';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
