import { fuzzySearchCard } from '$lib/api/card-service';
import type { DetectedCard } from './store';

const OCR_ATTEMPTS = 4;

function buildNameAttempts(raw: string): string[] {
	const attempts = [
		raw,
		raw.split('//')[0].trim(),
		raw.split(',')[0].trim(),
		raw.replace(/[^a-zA-Z0-9\s]/g, '').trim()
	];
	return [...new Set(attempts)];
}

export function cleanOCRText(text: string): string {
	return text
		.replace(/[^a-zA-Z0-9\s\-'/,Æéèàùâêîôûäëïöüç&().]/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export async function verifyCardWithOcr(
	cardName: string,
	confidence: number,
	detectionClass: string
): Promise<Omit<DetectedCard, 'detectionId'> | null> {
	const attempts = buildNameAttempts(cardName);

	for (const attempt of attempts) {
		try {
			const card = await fuzzySearchCard('mtg', attempt);

			if (card) {
				const setMatch = detectionClass.match(/\[([^\]]+)\]/);
				const detectedSet = setMatch ? setMatch[1] : card.setCode?.toUpperCase();

				return {
					name: card.name,
					qty: 1,
					imageUrl: card.imageUrl,
					priceUsd: card.prices.usd ?? null,
					set: detectedSet,
					setName: card.setName,
					ocrConfidence: confidence,
					boundingBox: { x: 0, y: 0, width: 0, height: 0 }
				};
			}
		} catch (err) {
			console.log(`Card lookup attempt "${attempt}" failed:`, err);
		}
	}

	return null;
}
