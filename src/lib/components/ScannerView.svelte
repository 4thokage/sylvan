<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Tesseract from 'tesseract.js';
	import {
		Camera,
		ScanLine,
		X,
		Loader2,
		Trash2,
		Target,
		CheckCircle2,
		AlertCircle
	} from 'lucide-svelte';
	import { createJSDetector, type JSContourDetector } from '$lib/scanner/jsDetector';
	import type { Detection } from '$lib/scanner/types';
	import type { BoundingBox } from '$lib/scanner/geometry';
	import { extractCardRegion } from '$lib/scanner/geometry';
	import { enhanceForMagicFonts, imageDataToDataURL } from '$lib/scanner/imageProcessing';
	import { detectedCards, type DetectedCard } from '$lib/scanner/store';

	interface Props {
		onCardsChange?: (cards: DetectedCard[]) => void;
	}

	let { onCardsChange }: Props = $props();

	let videoRef: HTMLVideoElement | undefined = $state();
	let canvasRef: HTMLCanvasElement | undefined = $state();
	let stream: MediaStream | null = $state(null);
	let detector: JSContourDetector | null = $state(null);
	let worker: Tesseract.Worker | null = $state(null);

	let scannerState:
		| 'idle'
		| 'loading'
		| 'detecting'
		| 'capturing'
		| 'processing'
		| 'success'
		| 'error' = $state('idle');
	let error: string | null = $state(null);
	let isCameraReady = false;
	let isDetectorReady = false;
	let currentDetections: Detection[] = $state([]);
	let processingCard: string | null = $state(null);
	let lastResult: { name: string; set?: string; confidence: number; success: boolean } | null =
		$state(null);

	const DETECTION_INTERVAL_MS = 200;
	const MIN_CONFIDENCE = 0.3;
	const STABILITY_FRAMES = 3;
	const STABILITY_TOLERANCE = 30;

	const trackedDetections = new Map<
		string,
		{
			detection: Detection;
			stableFrames: number;
			lastPositions: BoundingBox[];
			captured: boolean;
		}
	>();

	let animationFrameId: number | null = null;
	let lastDetectionTime = 0;
	let isProcessingCapture = false;

	onMount(async () => {
		console.log('[ScannerView] Starting initialization...');
		await initCamera();
		await initDetector();
		await initWorker();

		// Only start detection loop if both camera and detector are ready
		if (isCameraReady && isDetectorReady) {
			scannerState = 'detecting';
			startDetectionLoop();
		}
	});

	onDestroy(() => {
		stopDetectionLoop();
		stopCamera();
		if (worker) {
			worker.terminate();
		}
		if (detector) {
			detector.cleanup();
		}
	});

	$effect(() => {
		if (onCardsChange && $detectedCards) {
			onCardsChange($detectedCards);
		}
	});

	async function initCamera() {
		try {
			scannerState = 'loading';
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment',
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				},
				audio: false
			});

			if (videoRef) {
				videoRef.srcObject = stream;
				await videoRef.play();

				// Wait for video to have valid dimensions
				await new Promise<void>((resolve) => {
					if (videoRef!.videoWidth > 0 && videoRef!.videoHeight > 0) {
						resolve();
					} else {
						videoRef!.addEventListener('loadedmetadata', () => resolve(), { once: true });
					}
				});

				updateCanvasSize();
			}

			isCameraReady = true;
			console.log('[ScannerView] Camera ready');
		} catch (err) {
			console.error('Camera error:', err);
			scannerState = 'error';
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				error = 'Camera permission denied. Please allow camera access.';
			} else if (err instanceof DOMException && err.name === 'NotFoundError') {
				error = 'No camera found. Please connect a camera.';
			} else {
				error = 'Failed to access camera.';
			}
		}
	}

	async function initDetector() {
		try {
			console.log('[ScannerView] Initializing detector...');
			detector = createJSDetector({
				threshold: 100,
				minArea: 5000,
				minAspectRatio: 0.5,
				maxAspectRatio: 0.85
			});
			detector.initialize();
			isDetectorReady = true;
			console.log('[ScannerView] Detector ready');
		} catch (err) {
			console.error('Failed to init detector:', err);
			scannerState = 'error';
			error = 'Failed to load card detector. Please refresh and try again.';
		}
	}

	async function initWorker() {
		try {
			const DEBUG = import.meta.env.DEV;
			worker = await Tesseract.createWorker('eng', 1, {
				logger: DEBUG ? (m) => console.log('[Tesseract]', m) : () => {}
			});

			await worker.setParameters({
				tessedit_char_whitelist:
					'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\'"-,/&.',
				tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
				tessedit_ocr_engine_mode: '3',
				preserve_interword_spaces: '1'
			});
		} catch (err) {
			console.error('Failed to init Tesseract worker:', err);
		}
	}

	function updateCanvasSize() {
		if (videoRef && canvasRef && videoRef.videoWidth && videoRef.videoHeight) {
			canvasRef.width = videoRef.videoWidth;
			canvasRef.height = videoRef.videoHeight;
		}
	}

	function startDetectionLoop() {
		function loop(timestamp: number) {
			if (timestamp - lastDetectionTime >= DETECTION_INTERVAL_MS) {
				lastDetectionTime = timestamp;
				runDetection();
			}
			animationFrameId = requestAnimationFrame(loop);
		}
		animationFrameId = requestAnimationFrame(loop);
	}

	function stopDetectionLoop() {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
	}

	function runDetection() {
		if (
			!videoRef ||
			!canvasRef ||
			!detector ||
			!isDetectorReady ||
			scannerState === 'processing' ||
			scannerState === 'capturing' ||
			scannerState === 'loading' ||
			scannerState === 'error'
		) {
			return;
		}

		// Additional safety checks
		if (!videoRef.videoWidth || !videoRef.videoHeight || videoRef.videoWidth < 100) {
			return;
		}

		try {
			const detections = detector.detect(videoRef);
			currentDetections = detections;
			drawDetections(detections);
			checkAutoCapture(detections);
		} catch (err) {
			console.error('Detection error:', err);
		}
	}

	function drawDetections(detections: Detection[]) {
		if (!canvasRef || !videoRef) return;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

		for (const detection of detections) {
			const box: BoundingBox = {
				x: detection.x,
				y: detection.y,
				width: detection.width,
				height: detection.height
			};
			const confidence = Math.round(detection.confidence * 100);
			const tracked = trackedDetections.get(detection.class);

			let boxColor = '#10b981';
			if (tracked && tracked.captured) {
				boxColor = '#22c55e';
			} else if (detection.confidence >= MIN_CONFIDENCE) {
				boxColor = '#34d399';
			}

			drawTargetingUI(ctx, box, detection.class, confidence, boxColor);
			updateTracking(detection, box);
		}
	}

	function drawTargetingUI(
		ctx: CanvasRenderingContext2D,
		box: BoundingBox,
		label: string,
		confidence: number,
		color: string
	) {
		const { x, y, width, height } = box;
		const cornerLength = Math.min(30, width / 4, height / 4);

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';

		ctx.beginPath();
		ctx.moveTo(x, y + cornerLength);
		ctx.lineTo(x, y);
		ctx.lineTo(x + cornerLength, y);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(x + width - cornerLength, y);
		ctx.lineTo(x + width, y);
		ctx.lineTo(x + width, y + cornerLength);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(x, y + height - cornerLength);
		ctx.lineTo(x, y + height);
		ctx.lineTo(x + cornerLength, y + height);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(x + width - cornerLength, y + height);
		ctx.lineTo(x + width, y + height);
		ctx.lineTo(x + width, y + height - cornerLength);
		ctx.stroke();

		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x, y - 28, 140, 24);

		ctx.fillStyle = color;
		ctx.font = 'bold 14px system-ui, sans-serif';
		ctx.fillText('TARGETING', x + 8, y - 10);

		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(x + width - 50, y + height + 4, 48, 20);

		ctx.fillStyle = confidence >= 30 ? '#22c55e' : '#fbbf24';
		ctx.font = '12px system-ui, sans-serif';
		ctx.fillText(`${confidence}%`, x + width - 46, y + height + 18);
	}

	function updateTracking(detection: Detection, box: BoundingBox) {
		let tracked = trackedDetections.get(detection.class);

		if (!tracked) {
			tracked = {
				detection,
				stableFrames: 0,
				lastPositions: [],
				captured: false
			};
			trackedDetections.set(detection.class, tracked);
		}

		if (tracked.lastPositions.length > 0) {
			const lastBox = tracked.lastPositions[tracked.lastPositions.length - 1];
			if (isStable(box, lastBox, STABILITY_TOLERANCE)) {
				tracked.stableFrames = Math.min(STABILITY_FRAMES, tracked.stableFrames + 1);
			} else {
				tracked.stableFrames = 0;
			}
		}

		tracked.lastPositions.push(box);
		if (tracked.lastPositions.length > STABILITY_FRAMES) {
			tracked.lastPositions.shift();
		}

		tracked.detection = detection;
	}

	function isStable(current: BoundingBox, previous: BoundingBox, tolerance: number): boolean {
		const currentCenter = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
		const previousCenter = {
			x: previous.x + previous.width / 2,
			y: previous.y + previous.height / 2
		};

		const dx = Math.abs(currentCenter.x - previousCenter.x);
		const dy = Math.abs(currentCenter.y - previousCenter.y);

		return dx <= tolerance && dy <= tolerance;
	}

	async function checkAutoCapture(detections: Detection[]) {
		if (isProcessingCapture || !videoRef || !worker) return;

		for (const detection of detections) {
			if (detection.confidence < MIN_CONFIDENCE) continue;

			const tracked = trackedDetections.get(detection.class);
			if (!tracked || (!tracked.captured && tracked.stableFrames >= STABILITY_FRAMES)) {
				await captureAndProcess(detection);
			}
		}
	}

	async function captureAndProcess(detection: Detection) {
		if (!videoRef || isProcessingCapture) return;

		const tracked = trackedDetections.get(detection.class);
		if (tracked && tracked.captured) return;

		isProcessingCapture = true;
		scannerState = 'capturing';
		processingCard = detection.class;

		try {
			const box: BoundingBox = {
				x: detection.x,
				y: detection.y,
				width: detection.width,
				height: detection.height
			};

			const titleImageData = extractCardRegion(videoRef, box, 0.15);
			const enhancedData = enhanceForMagicFonts(titleImageData);
			const dataUrl = imageDataToDataURL(enhancedData);

			scannerState = 'processing';

			const { data } = await worker!.recognize(dataUrl);
			const text = cleanOCRText(data.text);

			if (text.length >= 2 && data.confidence >= 40) {
				const card = await fetchCardFromScryfall(text, data.confidence, detection.class);

				if (card) {
					detectedCards.addCard(card);
					lastResult = {
						name: card.name,
						set: card.set,
						confidence: data.confidence,
						success: true
					};
				} else {
					lastResult = { name: text, confidence: data.confidence, success: false };
				}
			}

			if (tracked) {
				tracked.captured = true;
			}

			setTimeout(() => {
				if (tracked) {
					tracked.captured = false;
					tracked.stableFrames = 0;
					tracked.lastPositions = [];
				}
			}, 5000);

			scannerState = 'detecting';
		} catch (err) {
			console.error('Capture error:', err);
			scannerState = 'detecting';
		} finally {
			isProcessingCapture = false;
			processingCard = null;
		}
	}

	async function fetchCardFromScryfall(
		cardName: string,
		confidence: number,
		detectionClass: string
	) {
		const attempts = [
			cardName,
			cardName.split('//')[0].trim(),
			cardName.split(',')[0].trim(),
			cardName.replace(/[^a-zA-Z0-9\s]/g, '').trim()
		];

		const uniqueAttempts = [...new Set(attempts)];

		for (const attempt of uniqueAttempts) {
			try {
				const encodedName = encodeURIComponent(attempt);
				const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodedName}`, {
					headers: {
						Accept: 'application/json',
						'User-Agent': 'SylvanApp/1.0 (jsr@jose-rodrigues.info)'
					}
				});

				if (response.ok) {
					const data = await response.json();
					const imageUrl =
						data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null;

					const setMatch = detectionClass.match(/\[([^\]]+)\]/);
					const detectedSet = setMatch ? setMatch[1] : data.set?.toUpperCase();

					return {
						name: data.name,
						qty: 1,
						imageUrl,
						priceUsd: data.prices?.usd ?? null,
						set: detectedSet,
						setName: data.set_name,
						ocrConfidence: confidence,
						boundingBox: { x: 0, y: 0, width: 0, height: 0 }
					};
				}
			} catch (err) {
				console.log(`Scryfall attempt "${attempt}" failed:`, err);
			}
		}

		return null;
	}

	function cleanOCRText(text: string): string {
		return text
			.replace(/[^a-zA-Z0-9\s\-'/,Æéèàùâêîôûäëïöüç&().]/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
		}
		stopDetectionLoop();
	}

	function retryCamera() {
		scannerState = 'idle';
		error = null;
		initCamera();
	}

	function clearScannedCards() {
		detectedCards.clearCards();
		lastResult = null;
		trackedDetections.clear();
	}

	function dismissResult() {
		lastResult = null;
	}
</script>

<svelte:window onresize={updateCanvasSize} />

<div class="relative flex h-full w-full flex-col overflow-hidden bg-black">
	<video
		bind:this={videoRef}
		class="absolute inset-0 h-full w-full object-cover"
		autoplay
		playsinline
		muted
	></video>

	<canvas
		bind:this={canvasRef}
		class="pointer-events-none absolute inset-0 h-full w-full object-cover"
	></canvas>

	{#if scannerState === 'error'}
		<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6">
			<Camera class="mb-4 h-16 w-16 text-red-500" />
			<p class="text-center text-lg font-medium text-white">{error}</p>
			<button
				onclick={retryCamera}
				class="mt-4 rounded-lg bg-emerald-600 px-6 py-3 text-white transition-colors hover:bg-emerald-500"
			>
				Try Again
			</button>
		</div>
	{/if}

	{#if scannerState === 'loading'}
		<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6">
			<Loader2 class="mb-4 h-16 w-16 animate-spin text-emerald-400" />
			<p class="text-center text-lg font-medium text-white">Loading OpenCV...</p>
			<p class="mt-2 text-sm text-zinc-400">Initializing card detector</p>
		</div>
	{/if}

	{#if scannerState === 'capturing'}
		<div class="absolute inset-0 flex items-center justify-center bg-black/30">
			<div class="flex flex-col items-center gap-2 rounded-xl bg-black/80 px-6 py-4">
				<ScanLine class="h-8 w-8 animate-pulse text-emerald-400" />
				<span class="text-sm font-medium text-white">Capturing {processingCard}</span>
			</div>
		</div>
	{/if}

	{#if scannerState === 'processing'}
		<div class="absolute inset-0 flex items-center justify-center bg-black/30">
			<div class="flex flex-col items-center gap-2 rounded-xl bg-black/80 px-6 py-4">
				<Loader2 class="h-8 w-8 animate-spin text-emerald-400" />
				<span class="text-sm font-medium text-white">Processing OCR...</span>
			</div>
		</div>
	{/if}

	<div class="absolute top-0 right-0 left-0 p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2">
					<Target class="h-4 w-4 text-emerald-400" />
					<span class="text-sm font-medium text-white">
						{$detectedCards.length} detected
					</span>
				</div>

				{#if currentDetections.length > 0}
					<div class="flex items-center gap-1 rounded bg-black/40 px-2 py-1">
						<span class="text-xs text-zinc-300">{currentDetections.length} in frame</span>
					</div>
				{/if}
			</div>

			<button
				onclick={clearScannedCards}
				class="flex items-center gap-1 rounded-lg bg-black/60 px-3 py-2 text-sm text-zinc-300 transition-colors hover:text-white"
			>
				<Trash2 class="h-4 w-4" />
				<span>Clear</span>
			</button>
		</div>
	</div>

	{#if lastResult}
		<div
			class="absolute right-0 bottom-0 left-0 max-h-[60%] overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 pb-6"
		>
			<button
				onclick={dismissResult}
				class="absolute top-4 right-4 rounded-full bg-zinc-800 p-1 text-zinc-400 hover:text-white"
			>
				<X class="h-5 w-5" />
			</button>

			{#if lastResult.success}
				{@const card = $detectedCards.find((c) => c.name === lastResult?.name)}
				{#if card}
					<div class="flex gap-4">
						{#if card.imageUrl}
							<img
								src={card.imageUrl}
								alt={card.name}
								class="h-40 w-28 rounded-lg object-cover shadow-lg"
							/>
						{/if}
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<CheckCircle2 class="h-5 w-5 text-emerald-400" />
								<h3 class="text-xl font-bold text-white">{card.name}</h3>
							</div>
							{#if card.setName}
								<p class="text-sm text-zinc-400">{card.setName}</p>
							{/if}
							{#if card.priceUsd}
								<p class="mt-2 text-lg font-semibold text-emerald-400">
									${card.priceUsd}
								</p>
							{:else}
								<p class="mt-2 text-sm text-zinc-500">No price available</p>
							{/if}
							<p class="mt-2 text-sm text-zinc-500">
								×{card.qty} in list
							</p>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex items-center gap-2">
					<AlertCircle class="h-5 w-5 text-yellow-400" />
					<p class="text-lg font-medium text-white">Could not find card</p>
				</div>
				<p class="mt-2 text-sm text-zinc-400">
					"{lastResult.name}" ({Math.round(lastResult.confidence)}%)
				</p>
			{/if}
		</div>
	{/if}
</div>
