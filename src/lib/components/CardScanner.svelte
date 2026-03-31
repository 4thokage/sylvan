<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Tesseract from 'tesseract.js';
	import {
		Camera,
		ScanLine,
		X,
		Loader2,
		Trash2,
		Play,
		Pause,
		Bug,
		Move,
		Maximize2
	} from 'lucide-svelte';
	import {
		cropAndProcessImage,
		calculateReticleRegion,
		imageDataToDataURL
	} from '$lib/scanner/imageProcessing';
	import type { ScannedCard, ScannerState, ScanResult } from '$lib/scanner/types';

	interface Props {
		scannedCards?: ScannedCard[];
		onCardsChange?: (cards: ScannedCard[]) => void;
	}

	let { scannedCards = $bindable([]), onCardsChange }: Props = $props();

	let videoRef: HTMLVideoElement | undefined = $state();
	let canvasRef: HTMLCanvasElement | undefined = $state();
	let stream: MediaStream | null = $state(null);
	let scannerState: ScannerState = $state('idle');
	let error: string | null = $state(null);
	let lastResult: ScanResult | null = $state(null);

	let continuousMode = $state(false);
	let intervalMs = $state(3000);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	let reticleRegion = $state({ x: 0, y: 0, width: 0, height: 0 });
	let worker: Tesseract.Worker | null = null;
	let isProcessing = $state(false);

	// Debug mode
	let debugMode = $state(false);
	let capturedImageUrl: string | null = $state(null);
	let lastOcrText: string = $state('');
	let lastOcrConfidence: number = $state(0);

	// Reticle resize/edit mode
	let isEditingReticle = $state(false);
	let resizeMode:
		| 'none'
		| 'move'
		| 'resize-nw'
		| 'resize-ne'
		| 'resize-sw'
		| 'resize-se'
		| 'resize-n'
		| 'resize-s'
		| 'resize-w'
		| 'resize-e' = $state('none');
	let dragStart = $state({ x: 0, y: 0 });
	let reticleStart = $state({ x: 0, y: 0, width: 0, height: 0 });

	const RETICLE_TOP_PERCENT = 0.08;
	const RETICLE_HEIGHT_PERCENT = 0.12;
	const MIN_OCR_CONFIDENCE = 42; // 42% minimum confidence
	const MIN_RETICLE_SIZE = 60; // Minimum reticle dimension in pixels

	onMount(async () => {
		await initCamera();
		await initWorker();
	});

	onDestroy(() => {
		stopCamera();
		stopContinuousScan();
		if (worker) {
			worker.terminate();
		}
	});

	async function initCamera() {
		try {
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

				// Wait for loadedmetadata before calculating reticle
				if (videoRef.readyState >= 1) {
					updateReticleRegion();
				} else {
					videoRef.addEventListener('loadedmetadata', updateReticleRegion, { once: true });
				}
			}

			scannerState = 'idle';
		} catch (err) {
			console.error('Camera error:', err);
			scannerState = 'error';
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				error = 'Camera permission denied. Please allow camera access to scan cards.';
			} else if (err instanceof DOMException && err.name === 'NotFoundError') {
				error = 'No camera found. Please connect a camera and try again.';
			} else {
				error = 'Failed to access camera. Please check your device settings.';
			}
		}
	}

	function updateReticleRegion() {
		if (videoRef && videoRef.videoWidth && videoRef.videoHeight) {
			reticleRegion = calculateReticleRegion(
				videoRef.videoWidth,
				videoRef.videoHeight,
				RETICLE_TOP_PERCENT,
				RETICLE_HEIGHT_PERCENT
			);
		}
	}

	function resetReticleToDefault() {
		updateReticleRegion();
	}

	async function initWorker() {
		try {
			const DEBUG = import.meta.env.DEV;

			worker = await Tesseract.createWorker('eng', 1, {
				logger: DEBUG ? (m) => console.log('[Tesseract]', m) : () => {},
				errorHandler: (e) => console.error('[Tesseract Error]', e)
			});

			// Configure Tesseract for MTG card names
			await worker.setParameters({
				tessedit_char_whitelist:
					'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\'"-,/&.',
				tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
				tessedit_ocr_engine_mode: '3', // LSTM only
				preserve_interword_spaces: '1'
			});
		} catch (err) {
			console.error('Failed to init Tesseract worker:', err);
			scannerState = 'error';
			error = 'Failed to initialize OCR. Please refresh and try again.';
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
		}
	}

	// Reticle resize handlers
	function startResize(mode: typeof resizeMode, event: MouseEvent | TouchEvent) {
		if (!isEditingReticle) return;

		resizeMode = mode;
		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

		dragStart = { x: clientX, y: clientY };
		reticleStart = { ...reticleRegion };

		event.preventDefault();
		event.stopPropagation();
	}

	function handleMove(event: MouseEvent | TouchEvent) {
		if (resizeMode === 'none' || !videoRef) return;

		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

		const deltaX = clientX - dragStart.x;
		const deltaY = clientY - dragStart.y;

		const videoRect = videoRef.getBoundingClientRect();
		const scaleX = videoRef.videoWidth / videoRect.width;
		const scaleY = videoRef.videoHeight / videoRect.height;

		const scaledDeltaX = deltaX * scaleX;
		const scaledDeltaY = deltaY * scaleY;

		let newX = reticleStart.x;
		let newY = reticleStart.y;
		let newWidth = reticleStart.width;
		let newHeight = reticleStart.height;

		switch (resizeMode) {
			case 'move':
				newX = Math.max(
					0,
					Math.min(videoRef.videoWidth - reticleStart.width, reticleStart.x + scaledDeltaX)
				);
				newY = Math.max(
					0,
					Math.min(videoRef.videoHeight - reticleStart.height, reticleStart.y + scaledDeltaY)
				);
				break;
			case 'resize-nw':
				newX = Math.min(
					reticleStart.x + reticleStart.width - MIN_RETICLE_SIZE,
					reticleStart.x + scaledDeltaX
				);
				newY = Math.min(
					reticleStart.y + reticleStart.height - MIN_RETICLE_SIZE,
					reticleStart.y + scaledDeltaY
				);
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.x + reticleStart.width - newX);
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.y + reticleStart.height - newY);
				break;
			case 'resize-ne':
				newY = Math.min(
					reticleStart.y + reticleStart.height - MIN_RETICLE_SIZE,
					reticleStart.y + scaledDeltaY
				);
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.width + scaledDeltaX);
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.y + reticleStart.height - newY);
				newX = reticleStart.x;
				break;
			case 'resize-sw':
				newX = Math.min(
					reticleStart.x + reticleStart.width - MIN_RETICLE_SIZE,
					reticleStart.x + scaledDeltaX
				);
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.x + reticleStart.width - newX);
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.height + scaledDeltaY);
				newY = reticleStart.y;
				break;
			case 'resize-se':
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.width + scaledDeltaX);
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.height + scaledDeltaY);
				break;
			case 'resize-n':
				newY = Math.min(
					reticleStart.y + reticleStart.height - MIN_RETICLE_SIZE,
					reticleStart.y + scaledDeltaY
				);
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.y + reticleStart.height - newY);
				break;
			case 'resize-s':
				newHeight = Math.max(MIN_RETICLE_SIZE, reticleStart.height + scaledDeltaY);
				break;
			case 'resize-w':
				newX = Math.min(
					reticleStart.x + reticleStart.width - MIN_RETICLE_SIZE,
					reticleStart.x + scaledDeltaX
				);
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.x + reticleStart.width - newX);
				break;
			case 'resize-e':
				newWidth = Math.max(MIN_RETICLE_SIZE, reticleStart.width + scaledDeltaX);
				break;
		}

		// Constrain to video bounds
		newWidth = Math.min(newWidth, videoRef.videoWidth - newX);
		newHeight = Math.min(newHeight, videoRef.videoHeight - newY);

		reticleRegion = {
			x: Math.round(newX),
			y: Math.round(newY),
			width: Math.round(newWidth),
			height: Math.round(newHeight)
		};
	}

	function stopResize() {
		resizeMode = 'none';
	}

	function toggleEditMode() {
		isEditingReticle = !isEditingReticle;
		if (!isEditingReticle) {
			resizeMode = 'none';
		}
	}

	async function performScan() {
		if (!videoRef || !canvasRef || isProcessing || !worker) return;

		isProcessing = true;
		scannerState = 'processing';
		lastOcrText = '';
		lastOcrConfidence = 0;

		try {
			const imageData = cropAndProcessImage(videoRef, canvasRef, reticleRegion);
			const dataUrl = imageDataToDataURL(imageData);

			// Store for debug view
			capturedImageUrl = dataUrl;

			const { data } = await worker.recognize(dataUrl);
			const cleanedText = cleanOCRText(data.text);
			lastOcrText = cleanedText;
			lastOcrConfidence = data.confidence;

			if (cleanedText.length >= 2 && data.confidence >= MIN_OCR_CONFIDENCE) {
				await fetchCardFromScryfall(cleanedText, data.confidence);
			} else if (cleanedText.length >= 2) {
				// Low confidence - show debug info
				lastResult = {
					text: cleanedText,
					confidence: data.confidence,
					card: null,
					lowConfidence: true
				};
				scannerState = 'success';
				isProcessing = false;
			} else {
				scannerState = 'idle';
				isProcessing = false;
			}
		} catch (err) {
			console.error('Scan error:', err);
			scannerState = 'idle';
			isProcessing = false;
		}
	}

	async function fetchCardFromScryfall(cardName: string, confidence: number) {
		// Try multiple variations for better matching
		const attempts = [
			cardName,
			cardName.split('//')[0].trim(), // Double-faced cards
			cardName.split(',')[0].trim(), // First part of legendary names
			cardName.replace(/[^a-zA-Z0-9\s]/g, '').trim() // Alphanumeric only
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

					const scannedCard: ScannedCard = {
						name: data.name,
						qty: 1,
						imageUrl,
						priceUsd: data.prices?.usd ?? null,
						set: data.set,
						setName: data.set_name
					};

					addToScannedCards(scannedCard);
					lastResult = {
						text: cardName,
						confidence,
						card: scannedCard,
						matchedWith: attempt
					};
					scannerState = 'success';
					isProcessing = false;
					return;
				}
			} catch (err) {
				// Continue to next attempt
				console.log(`Scryfall attempt "${attempt}" failed:`, err);
			}
		}

		// All attempts failed
		lastResult = { text: cardName, confidence, card: null };
		scannerState = 'success';
		isProcessing = false;
	}

	function addToScannedCards(card: ScannedCard) {
		const existingIndex = scannedCards.findIndex(
			(c) => c.name.toLowerCase() === card.name.toLowerCase()
		);

		if (existingIndex >= 0) {
			scannedCards[existingIndex].qty += 1;
			scannedCards = [...scannedCards];
		} else {
			scannedCards = [...scannedCards, card];
		}

		onCardsChange?.(scannedCards);
	}

	function cleanOCRText(text: string): string {
		return (
			text
				// Allow comma, AE ligature, accented chars, parentheses common in MTG
				.replace(/[^a-zA-Z0-9\s\-'/,Æéèàùâêîôûäëïöüç&().]/gi, '')
				.replace(/\s+/g, ' ')
				.trim()
		);
	}

	function toggleContinuousScan() {
		if (continuousMode) {
			stopContinuousScan();
		} else {
			startContinuousScan();
		}
	}

	function startContinuousScan() {
		continuousMode = true;
		intervalId = setInterval(() => {
			if (!isProcessing && scannerState !== 'processing') {
				performScan();
			}
		}, intervalMs);
	}

	function stopContinuousScan() {
		continuousMode = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function clearScannedCards() {
		scannedCards = [];
		onCardsChange?.(scannedCards);
		lastResult = null;
		scannerState = 'idle';
		capturedImageUrl = null;
		lastOcrText = '';
	}

	function dismissResult() {
		lastResult = null;
		scannerState = 'idle';
	}

	function setIntervalMs(ms: number) {
		intervalMs = ms;
		if (continuousMode) {
			stopContinuousScan();
			startContinuousScan();
		}
	}

	function toggleDebugMode() {
		debugMode = !debugMode;
	}
</script>

<svelte:window onmousemove={handleMove} onmouseup={stopResize} onresize={updateReticleRegion} />

<div class="relative flex h-full w-full flex-col bg-black">
	<!-- Video Element -->
	<video
		bind:this={videoRef}
		class="absolute inset-0 h-full w-full object-cover"
		autoplay
		playsinline
		muted
	></video>

	<!-- Hidden Canvas for Processing -->
	<canvas bind:this={canvasRef} class="hidden"></canvas>

	<!-- Camera Error State -->
	{#if scannerState === 'error'}
		<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6">
			<Camera class="mb-4 h-16 w-16 text-red-500" />
			<p class="text-center text-lg font-medium text-white">{error}</p>
			<button
				onclick={initCamera}
				class="mt-4 rounded-lg bg-emerald-600 px-6 py-3 text-white transition-colors hover:bg-emerald-500"
			>
				Try Again
			</button>
		</div>
	{/if}

	<!-- Scanning Reticle Overlay - Using calculated region -->
	{#if scannerState !== 'error'}
		<div class="pointer-events-none absolute inset-0">
			<!-- Darkened areas outside reticle -->
			<div
				class="absolute top-0 right-0 left-0 bg-black/50"
				style="height: {reticleRegion.y}px;"
			></div>
			<div
				class="absolute right-0 bottom-0 left-0 bg-black/50"
				style="top: {reticleRegion.y + reticleRegion.height}px;"
			></div>
			<div
				class="absolute top-0 left-0 bg-black/50"
				style="top: {reticleRegion.y}px; height: {reticleRegion.height}px; width: {reticleRegion.x}px;"
			></div>
			<div
				class="absolute top-0 right-0 bg-black/50"
				style="top: {reticleRegion.y}px; height: {reticleRegion.height}px; width: {reticleRegion.x}px;"
			></div>
		</div>

		<!-- Interactive Reticle Box -->
		<div
			class="absolute {isEditingReticle ? 'cursor-move' : 'pointer-events-none'}"
			class:border-2={!isEditingReticle}
			class:border-emerald-400={!isEditingReticle}
			class:border-4={isEditingReticle}
			class:border-yellow-400={isEditingReticle}
			style="left: {reticleRegion.x}px; top: {reticleRegion.y}px; width: {reticleRegion.width}px; height: {reticleRegion.height}px;"
			onmousedown={(e) => isEditingReticle && startResize('move', e)}
			onclick={(e) => isEditingReticle && e.stopPropagation()}
		>
			<!-- Corner markers (visible always) -->
			<span
				class="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 {isEditingReticle
					? 'border-yellow-400'
					: 'border-emerald-400'}"
			></span>
			<span
				class="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 {isEditingReticle
					? 'border-yellow-400'
					: 'border-emerald-400'}"
			></span>
			<span
				class="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 {isEditingReticle
					? 'border-yellow-400'
					: 'border-emerald-400'}"
			></span>
			<span
				class="absolute -right-1 -bottom-1 h-4 w-4 border-r-4 border-b-4 {isEditingReticle
					? 'border-yellow-400'
					: 'border-emerald-400'}"
			></span>

			{#if isEditingReticle}
				<!-- Corner resize handles -->
				<div
					class="absolute -top-3 -left-3 h-6 w-6 cursor-nw-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-nw', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute -top-3 -right-3 h-6 w-6 cursor-ne-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-ne', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute -bottom-3 -left-3 h-6 w-6 cursor-sw-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-sw', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute -right-3 -bottom-3 h-6 w-6 cursor-se-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-se', e)}
					onclick={(e) => e.stopPropagation()}
				></div>

				<!-- Edge resize handles -->
				<div
					class="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 cursor-n-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-n', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 cursor-s-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-s', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 cursor-w-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-w', e)}
					onclick={(e) => e.stopPropagation()}
				></div>
				<div
					class="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 cursor-e-resize rounded-full bg-yellow-400 shadow-lg"
					onmousedown={(e) => startResize('resize-e', e)}
					onclick={(e) => e.stopPropagation()}
				></div>

				<!-- Center move handle -->
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-yellow-400/80 px-2 py-1"
				>
					<Move class="h-4 w-4 text-black" />
				</div>

				<!-- Dimensions display -->
				<div
					class="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-yellow-400 px-2 py-1 text-xs whitespace-nowrap text-black"
				>
					{reticleRegion.width}×{reticleRegion.height}px
				</div>
			{/if}
		</div>

		<!-- Scan indicator -->
		{#if !isEditingReticle}
			<div
				class="absolute left-1/2 -translate-x-1/2"
				style="top: {reticleRegion.y + reticleRegion.height / 2}px;"
			>
				<span class="animate-pulse text-xs font-medium text-emerald-400"
					>Position card name here</span
				>
			</div>
		{/if}
	{/if}

	<!-- Debug Overlay -->
	{#if debugMode && capturedImageUrl}
		<div class="absolute top-2 right-2 z-50 max-w-xs rounded-lg bg-black/80 p-3">
			<p class="mb-2 text-xs font-bold text-white">Debug Capture</p>
			<img
				src={capturedImageUrl}
				alt="Captured region"
				class="mb-2 w-40 rounded border-2 border-emerald-400"
			/>
			<p class="text-xs text-zinc-300">OCR: "{lastOcrText || 'N/A'}"</p>
			<p class="text-xs text-zinc-300">Conf: {Math.round(lastOcrConfidence)}%</p>
			{#if lastResult?.lowConfidence}
				<p class="text-xs text-red-400">Low confidence - rejected</p>
			{/if}
		</div>
	{/if}

	<!-- Top Controls -->
	<div class="absolute top-0 right-0 left-0 p-4">
		<div class="flex justify-between gap-2">
			<button
				onclick={toggleDebugMode}
				class="rounded-lg bg-black/50 px-3 py-2 text-sm {debugMode
					? 'bg-emerald-600/80 text-white'
					: 'text-zinc-400'}"
			>
				<Bug class="h-4 w-4" />
			</button>

			{#if isEditingReticle}
				<button
					onclick={resetReticleToDefault}
					class="rounded-lg bg-black/50 px-3 py-2 text-sm text-zinc-400 hover:text-white"
				>
					Reset
				</button>
			{/if}

			<button
				onclick={toggleEditMode}
				class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm {isEditingReticle
					? 'bg-yellow-500 text-black'
					: 'bg-black/50 text-zinc-400'}"
			>
				<Maximize2 class="h-4 w-4" />
				<span>{isEditingReticle ? 'Done' : 'Edit'}</span>
			</button>
		</div>
	</div>

	<!-- Bottom Controls -->
	<div
		class="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black via-black/90 to-transparent p-4 pb-6"
	>
		<!-- Debug/Status Bar -->
		<div class="mb-3 flex items-center justify-between px-2">
			<div class="flex items-center gap-2 text-sm text-zinc-400">
				<span>{scannedCards.length} cards scanned</span>
				{#if lastOcrConfidence > 0}
					<span class="text-xs text-zinc-500">(last: {Math.round(lastOcrConfidence)}%)</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={toggleContinuousScan}
					class="flex items-center gap-1 rounded-lg px-3 py-1 text-sm {continuousMode
						? 'bg-red-600 text-white'
						: 'bg-zinc-800 text-zinc-300'}"
				>
					{#if continuousMode}
						<Pause class="h-3 w-3" />
						<span>Stop</span>
					{:else}
						<Play class="h-3 w-3" />
						<span>Auto</span>
					{/if}
				</button>
				<button
					onclick={clearScannedCards}
					class="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
				>
					<Trash2 class="h-3 w-3" />
					<span>Clear</span>
				</button>
			</div>
		</div>

		<!-- Interval Selector (when in continuous mode) -->
		{#if continuousMode}
			<div class="mb-3 flex items-center justify-center gap-2">
				<span class="text-xs text-zinc-400">Interval:</span>
				{#each [1000, 2000, 3000, 5000] as ms}
					<button
						onclick={() => setIntervalMs(ms)}
						class="rounded px-2 py-1 text-xs {intervalMs === ms
							? 'bg-emerald-600 text-white'
							: 'bg-zinc-800 text-zinc-400'}"
					>
						{ms / 1000}s
					</button>
				{/each}
			</div>
		{/if}

		<!-- Main Scan Button -->
		<button
			onclick={performScan}
			disabled={scannerState === 'processing' || scannerState === 'error' || isEditingReticle}
			class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
		>
			{#if scannerState === 'processing'}
				<Loader2 class="h-6 w-6 animate-spin" />
				<span>Processing...</span>
			{:else}
				<ScanLine class="h-6 w-6" />
				<span>Scan Card</span>
			{/if}
		</button>
	</div>

	<!-- Card Preview Drawer -->
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

			{#if lastResult.card}
				<div class="flex gap-4">
					{#if lastResult.card.imageUrl}
						<img
							src={lastResult.card.imageUrl}
							alt={lastResult.card.name}
							class="h-40 w-28 rounded-lg object-cover shadow-lg"
						/>
					{/if}
					<div class="flex-1">
						<h3 class="text-xl font-bold text-white">{lastResult.card.name}</h3>
						{#if lastResult.card.setName}
							<p class="text-sm text-zinc-400">{lastResult.card.setName}</p>
						{/if}
						{#if lastResult.card.priceUsd}
							<p class="mt-2 text-lg font-semibold text-emerald-400">
								${lastResult.card.priceUsd}
							</p>
						{:else}
							<p class="mt-2 text-sm text-zinc-500">No price available</p>
						{/if}
						<p class="mt-2 text-sm text-zinc-500">
							×{lastResult.card.qty} in list
						</p>
						{#if debugMode && lastResult.matchedWith}
							<p class="mt-1 text-xs text-zinc-600">
								Matched with: "{lastResult.matchedWith}"
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-center">
					{#if lastResult.lowConfidence}
						<p class="text-lg font-medium text-yellow-400">Low confidence result</p>
						<p class="mt-1 text-sm text-zinc-400">
							"{lastResult.text}" ({Math.round(lastResult.confidence)}%)
						</p>
						<p class="mt-2 text-xs text-zinc-500">
							Minimum confidence: {MIN_OCR_CONFIDENCE}%
						</p>
					{:else}
						<p class="text-lg font-medium text-white">Could not find card</p>
						<p class="mt-1 text-sm text-zinc-400">
							"{lastResult.text}" ({Math.round(lastResult.confidence)}%)
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
