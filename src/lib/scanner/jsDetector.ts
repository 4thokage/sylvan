import type { Detection } from './types';

export interface JSDetectorConfig {
	threshold?: number;
	minArea?: number;
	minAspectRatio?: number;
	maxAspectRatio?: number;
}

export class JSContourDetector {
	private threshold: number;
	private minArea: number;
	private minAspectRatio: number;
	private maxAspectRatio: number;
	private initialized = false;

	constructor(config: JSDetectorConfig = {}) {
		this.threshold = config.threshold ?? 128;
		this.minArea = config.minArea ?? 8000;
		this.minAspectRatio = config.minAspectRatio ?? 0.5;
		this.maxAspectRatio = config.maxAspectRatio ?? 0.85;
	}

	initialize(): void {
		this.initialized = true;
	}

	isReady(): boolean {
		return this.initialized;
	}

	detect(video: HTMLVideoElement): Detection[] {
		if (!this.initialized) {
			return [];
		}

		if (!video.videoWidth || !video.videoHeight || video.videoWidth < 100) {
			return [];
		}

		try {
			return this.detectContours(video);
		} catch (err) {
			console.error('[JSDetector] Detection error:', err);
			return [];
		}
	}

	private detectContours(video: HTMLVideoElement): Detection[] {
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) {
			return [];
		}

		ctx.drawImage(video, 0, 0);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = imageData.data;
		const width = canvas.width;
		const height = canvas.height;

		const gray = new Uint8ClampedArray(width * height);
		for (let i = 0; i < width * height; i++) {
			const r = data[i * 4];
			const g = data[i * 4 + 1];
			const b = data[i * 4 + 2];
			gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
		}

		const binary = new Uint8Array(width * height);
		for (let i = 0; i < width * height; i++) {
			binary[i] = gray[i] < this.threshold ? 0 : 1;
		}

		const dilated = this.dilate(binary, width, height, 3);
		const edges = this.findEdges(dilated, width, height);

		const contours = this.findContours(edges, binary, width, height);
		const detections: Detection[] = [];

		for (const contour of contours) {
			if (contour.length < 4) continue;

			const bounds = this.getBoundingBox(contour);
			const area = bounds.width * bounds.height;
			const aspectRatio = bounds.width / bounds.height;

			if (area < this.minArea) continue;
			if (aspectRatio < this.minAspectRatio || aspectRatio > this.maxAspectRatio) continue;

			const isRectangular = this.isRectangular(contour, bounds);
			if (!isRectangular) continue;

			detections.push({
				class: `card_${detections.length}`,
				confidence: Math.min(area / 50000, 0.9),
				x: bounds.x,
				y: bounds.y,
				width: bounds.width,
				height: bounds.height,
				videoWidth: width,
				videoHeight: height
			});
		}

		return detections;
	}

	private dilate(binary: Uint8Array, width: number, height: number, size: number): Uint8Array {
		const result = new Uint8Array(width * height);
		const half = Math.floor(size / 2);

		for (let y = half; y < height - half; y++) {
			for (let x = half; x < width - half; x++) {
				let hasWhite = false;
				for (let dy = -half; dy <= half; dy++) {
					for (let dx = -half; dx <= half; dx++) {
						if (binary[(y + dy) * width + (x + dx)] === 1) {
							hasWhite = true;
							break;
						}
					}
					if (hasWhite) break;
				}
				result[y * width + x] = hasWhite ? 1 : 0;
			}
		}

		return result;
	}

	private findEdges(binary: Uint8Array, width: number, height: number): Uint8Array {
		const edges = new Uint8Array(width * height);

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const idx = y * width + x;
				if (binary[idx] === 1) {
					const neighbors = [
						binary[idx - 1],
						binary[idx + 1],
						binary[idx - width],
						binary[idx + width]
					];
					if (neighbors.includes(0)) {
						edges[idx] = 1;
					}
				}
			}
		}

		return edges;
	}

	private findContours(
		edges: Uint8Array,
		binary: Uint8Array,
		width: number,
		height: number
	): number[][][] {
		const visited = new Uint8Array(width * height);
		const contours: number[][][] = [];

		const directions = [
			[0, -1],
			[1, -1],
			[1, 0],
			[1, 1],
			[0, 1],
			[-1, 1],
			[-1, 0],
			[-1, -1]
		];

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const idx = y * width + x;
				if (edges[idx] === 1 && !visited[idx]) {
					const contour: number[][] = [];
					let cx = x;
					let cy = y;
					let dir = 0;
					let steps = 0;
					const maxSteps = 1000;

					while (steps < maxSteps) {
						contour.push([cx, cy]);
						visited[cy * width + cx] = 1;

						let found = false;
						for (let i = 0; i < 8; i++) {
							const newDir = (dir + i) % 8;
							const nx = cx + directions[newDir][0];
							const ny = cy + directions[newDir][1];
							const nidx = ny * width + nx;

							if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && edges[nidx] === 1) {
								cx = nx;
								cy = ny;
								dir = (newDir + 5) % 8;
								found = true;
								break;
							}
						}

						if (!found) break;
						steps++;
					}

					if (contour.length >= 20 && contour.length <= 500) {
						contours.push(contour);
					}
				}
			}
		}

		return contours;
	}

	private getBoundingBox(contour: number[][]): {
		x: number;
		y: number;
		width: number;
		height: number;
	} {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const [x, y] of contour) {
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}

	private isRectangular(
		contour: number[][],
		bounds: { x: number; y: number; width: number; height: number }
	): boolean {
		if (contour.length < 4) return false;

		let cornerCount = 0;
		let prevAngle = 0;
		let angleChanges = 0;

		for (let i = 0; i < contour.length; i++) {
			const curr = contour[i];
			const next = contour[(i + 1) % contour.length];
			const dx = next[0] - curr[0];
			const dy = next[1] - curr[1];
			const angle = Math.atan2(dy, dx);

			if (i > 0) {
				let angleDiff = Math.abs(angle - prevAngle);
				if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
				if (angleDiff > Math.PI / 4) {
					angleChanges++;
				}
			}
			prevAngle = angle;
		}

		return angleChanges >= 3 && angleChanges <= 6;
	}

	cleanup(): void {
		this.initialized = false;
	}
}

export function createJSDetector(config?: JSDetectorConfig): JSContourDetector {
	return new JSContourDetector(config);
}
