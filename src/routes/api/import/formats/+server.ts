import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json({
		success: true,
		data: {
			formats: [
				{
					id: 'text',
					name: 'Plain Text / MTG Arena / Moxfield / Archidekt',
					description:
						'One card per line. Arena/Moxfield/Archidekt exports ("4 Lightning Bolt (CLB) 785") are auto-detected; "SB:" sideboard lines are ignored.',
					example: '4 Lightning Bolt (CLB) 785\n2 Sol Ring (CLB) 123\n1 Black Lotus'
				},
				{
					id: 'csv',
					name: 'CSV (generic / Deckbox)',
					description: 'Comma-separated with name,quantity headers (Deckbox tab-separated also works).',
					example: 'Name,Quantity\nLightning Bolt,4\nSol Ring,2'
				},
				{
					id: 'tcgplayer',
					name: 'TCGplayer CSV',
					description: 'TCGplayer collection/decklist export (Count, Name, Edition, Foil, … headers).',
					example: 'Count,Name,Edition,Foil\n4,Lightning Bolt,CLB,false\n2,Sol Ring,CLB,true'
				}
			]
		}
	});
};
