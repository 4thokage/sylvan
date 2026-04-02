import type { Detection } from './types';

export interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

const MODEL_INPUT_SIZE = 416;
const STABILITY_TOLERANCE = 20;

export function modelToVideoCoords(
	detection: Detection,
	videoWidth: number,
	videoHeight: number
): BoundingBox {
	const scaleX = videoWidth / MODEL_INPUT_SIZE;
	const scaleY = videoHeight / MODEL_INPUT_SIZE;

	return {
		x: detection.x * scaleX,
		y: detection.y * scaleY,
		width: detection.width * scaleX,
		height: detection.height * scaleY
	};
}

export function extractCardRegion(
	video: HTMLVideoElement,
	boundingBox: BoundingBox,
	topPercent: number = 0.15
): ImageData {
	const titleRegion: BoundingBox = {
		x: boundingBox.x,
		y: boundingBox.y,
		width: boundingBox.width,
		height: boundingBox.height * topPercent
	};

	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(titleRegion.width);
	canvas.height = Math.ceil(titleRegion.height);

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	ctx.drawImage(
		video,
		titleRegion.x,
		titleRegion.y,
		titleRegion.width,
		titleRegion.height,
		0,
		0,
		titleRegion.width,
		titleRegion.height
	);

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function extractFullCardImage(video: HTMLVideoElement, boundingBox: BoundingBox): string {
	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(boundingBox.width);
	canvas.height = Math.ceil(boundingBox.height);

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	ctx.drawImage(
		video,
		boundingBox.x,
		boundingBox.y,
		boundingBox.width,
		boundingBox.height,
		0,
		0,
		canvas.width,
		canvas.height
	);

	return canvas.toDataURL('image/png');
}

export function getBoxCenter(box: BoundingBox): Point {
	return {
		x: box.x + box.width / 2,
		y: box.y + box.height / 2
	};
}

export function isStable(
	current: BoundingBox,
	previous: BoundingBox,
	tolerance: number = STABILITY_TOLERANCE
): boolean {
	const currentCenter = getBoxCenter(current);
	const previousCenter = getBoxCenter(previous);

	const dx = Math.abs(currentCenter.x - previousCenter.x);
	const dy = Math.abs(currentCenter.y - previousCenter.y);

	return dx <= tolerance && dy <= tolerance;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function getCanvasToVideoScale(
	video: HTMLVideoElement,
	canvas: HTMLCanvasElement
): { scaleX: number; scaleY: number } {
	const videoRect = video.getBoundingClientRect();
	const canvasRect = canvas.getBoundingClientRect();

	return {
		scaleX: video.videoWidth / canvasRect.width,
		scaleY: video.videoHeight / canvasRect.height
	};
}
