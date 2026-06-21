import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  return json({
    success: true,
    data: {
      formats: [
        {
          id: 'text',
          name: 'Plain Text',
          description: 'One card per line: "4 Lightning Bolt" or "Lightning Bolt"',
          example: '4 Lightning Bolt\n2 Sol Ring\n1 Black Lotus'
        },
        {
          id: 'csv',
          name: 'CSV',
          description: 'Comma-separated: name,quantity',
          example: 'Lightning Bolt,4\nSol Ring,2\nBlack Lotus,1'
        },
        {
          id: 'deckbox',
          name: 'Deckbox',
          description: 'Tab-separated export from Deckbox.org',
          example: 'Name\tCount\nLightning Bolt\t4\nSol Ring\t2'
        },
        {
          id: 'arena',
          name: 'MTG Arena',
          description: 'Direct paste from MTG Arena deck export',
          example: '4 Lightning Bolt (CLB) 785\n2 Sol Ring (CLB) 123'
        },
        {
          id: 'tappedout',
          name: 'TappedOut',
          description: 'Paste from TappedOut.net decklist',
          example: '4 Lightning Bolt\nSB: 2 Sol Ring'
        }
      ]
    }
  });
};
