export interface CropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function createProcessedCanvas(
	videoWidth: number,
	videoHeight: number,
	reticleRegion: CropRegion
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = reticleRegion.width;
	canvas.height = reticleRegion.height;
	return canvas;
}

export function cropAndProcessImage(
	video: HTMLVideoElement,
	canvas: HTMLCanvasElement,
	reticleRegion: CropRegion
): ImageData {
	// Ensure canvas dimensions match reticle region
	canvas.width = reticleRegion.width;
	canvas.height = reticleRegion.height;

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Failed to get canvas context');

	// Apply preprocessing filters: grayscale + increased contrast for MTG fonts
	ctx.filter = 'grayscale(1) contrast(1.5) brightness(1.1)';
	ctx.drawImage(
		video,
		reticleRegion.x,
		reticleRegion.y,
		reticleRegion.width,
		reticleRegion.height,
		0,
		0,
		reticleRegion.width,
		reticleRegion.height
	);

	// Reset filter for further processing
	ctx.filter = 'none';

	const imageData = ctx.getImageData(0, 0, reticleRegion.width, reticleRegion.height);

	// Apply MTG-specific font enhancement
	return enhanceForMagicFonts(imageData);
}

export function calculateReticleRegion(
	videoWidth: number,
	videoHeight: number,
	reticleTopPercent: number = 0.1,
	reticleHeightPercent: number = 0.15
): CropRegion {
	const reticleY = videoHeight * reticleTopPercent;
	const reticleHeight = videoHeight * reticleHeightPercent;
	const reticleX = videoWidth * 0.1;
	const reticleWidth = videoWidth * 0.8;

	return {
		x: Math.round(reticleX),
		y: Math.round(reticleY),
		width: Math.round(reticleWidth),
		height: Math.round(reticleHeight)
	};
}

/**
 * Enhanced image processing specifically for Magic: The Gathering card fonts.
 * Uses adaptive thresholding to convert grayscale image to black/white,
 * which improves OCR accuracy on stylized card title fonts.
 */
export function enhanceForMagicFonts(imageData: ImageData): ImageData {
	const data = imageData.data;
	const width = imageData.width;
	const height = imageData.height;

	// Calculate average brightness of the image for adaptive threshold
	let totalBrightness = 0;
	for (let i = 0; i < data.length; i += 4) {
		totalBrightness += data[i]; // Red channel (grayscale, so all channels equal)
	}
	const avgBrightness = totalBrightness / (width * height);

	// Adaptive threshold: use average brightness with an offset
	// This works better than fixed threshold for varying lighting conditions
	const threshold = Math.max(100, Math.min(180, avgBrightness * 0.85));

	// Apply adaptive thresholding
	for (let i = 0; i < data.length; i += 4) {
		const gray = data[i];

		// Make dark pixels darker, light pixels lighter for better contrast
		let enhanced: number;
		if (gray > threshold) {
			// Light pixel - make it white
			enhanced = 255;
		} else if (gray > threshold * 0.7) {
			// Medium pixel - adjust based on how close to threshold
			const ratio = (gray - threshold * 0.7) / (threshold * 0.3);
			enhanced = Math.round(128 + ratio * 127);
		} else {
			// Dark pixel - make it black
			enhanced = 0;
		}

		data[i] = enhanced;
		data[i + 1] = enhanced;
		data[i + 2] = enhanced;
		// Alpha channel stays the same
	}

	return imageData;
}

export function imageDataToDataURL(imageData: ImageData): string {
	const canvas = document.createElement('canvas');
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Failed to get canvas context');

	ctx.putImageData(imageData, 0, 0);
	return canvas.toDataURL('image/png');
}
