export interface ScannedCard {
	name: string;
	qty: number;
	imageUrl: string | null;
	priceUsd: string | null;
	set?: string;
	setName?: string;
}

export interface ScryfallCardResponse {
	object: 'card';
	id: string;
	name: string;
	image_uris: {
		normal: string;
		large: string;
	} | null;
	card_faces?: Array<{
		name: string;
		image_uris: {
			normal: string;
			large: string;
		};
	}>;
	prices: {
		usd: string | null;
		usd_foil: string | null;
		eur: string | null;
	};
	set?: string;
	set_name?: string;
}

export type ScannerState = 'idle' | 'processing' | 'success' | 'error';

export interface ScannerError {
	type: 'permission' | 'camera' | 'ocr' | 'api';
	message: string;
}

export interface ScanResult {
	text: string;
	confidence: number;
	card: ScannedCard | null;
	lowConfidence?: boolean;
	matchedWith?: string;
}

export interface WorkerMessage {
	type: 'process';
	imageData: ImageData;
}

export interface WorkerResponse {
	type: 'result' | 'error';
	text?: string;
	confidence?: number;
	error?: string;
}
