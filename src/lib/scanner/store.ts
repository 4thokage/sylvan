import { writable, derived, get } from 'svelte/store';
import type { ScannedCard, Detection } from './types';

export interface DetectedCard extends ScannedCard {
	detectionId: string;
	set?: string;
	ocrConfidence: number;
	boundingBox: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

function createDetectedCardsStore() {
	const { subscribe, set, update } = writable<DetectedCard[]>([]);

	return {
		subscribe,
		set,
		update,

		addCard: (card: Omit<DetectedCard, 'detectionId'>) => {
			update((cards) => {
				const existingIndex = cards.findIndex(
					(c) =>
						c.name.toLowerCase() === card.name.toLowerCase() &&
						c.set?.toLowerCase() === card.set?.toLowerCase()
				);

				if (existingIndex >= 0) {
					const updated = [...cards];
					updated[existingIndex].qty += card.qty;
					updated[existingIndex].ocrConfidence = Math.max(
						updated[existingIndex].ocrConfidence,
						card.ocrConfidence
					);
					return updated;
				}

				const detectionId = `${card.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
				return [...cards, { ...card, detectionId }];
			});
		},

		removeCard: (detectionId: string) => {
			update((cards) => cards.filter((c) => c.detectionId !== detectionId));
		},

		clearCards: () => {
			set([]);
		},

		hasCard: (name: string, setCode?: string): boolean => {
			const cards = get({ subscribe });
			return cards.some(
				(c) =>
					c.name.toLowerCase() === name.toLowerCase() &&
					(!setCode || c.set?.toLowerCase() === setCode?.toLowerCase())
			);
		}
	};
}

export const detectedCards = createDetectedCardsStore();

export const scannedCards = derived(detectedCards, ($detectedCards) =>
	$detectedCards.map((card) => ({
		name: card.name,
		qty: card.qty,
		imageUrl: card.imageUrl,
		priceUsd: card.priceUsd,
		set: card.set,
		setName: card.setName
	}))
);
