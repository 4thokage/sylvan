import { getSupabase } from '$lib/server/supabase';
import { getCardsByIdentifiers, getProvider } from '$lib/api/card-service';
import type { TcgCard, TcgProvider } from '$lib/api/providers/types';
import {
	bulkEnsureCardsAndPrintings,
	type BulkCardSpec,
	type BulkPrintingSpec,
	cardRowToLookupResult,
	type CardLookupResult
} from './card.service';

export interface ResolvedCard {
	cardId: string;
	cardName: string;
	printingId: string;
	setCode: string | null;
	collectorNumber: string | null;
}

export interface ResolveCardsInput {
	name: string;
	qty: number;
	set?: string;
	collectorNumber?: string;
	finish?: string;
	cardPrintingId?: string | null;
}

export interface ResolvedCardOutput extends ResolvedCard {
	qty: number;
	index: number;
}

export function resolvePrinting(
	cardResult: CardLookupResult,
	input: ResolveCardsInput
): string | null {
	// Only honor a client-supplied printing id if it is a real UUID that already
	// belongs to one of the resolved card's printings. The client may send a
	// provider composite key (e.g. `<scryfallId>-foil`) or a stale printing id,
	// neither of which should be trusted as a foreign key. Resolving by physical
	// attributes instead also prevents a caller from attaching an arbitrary
	// printing to their collection/wishlist.
	if (input.cardPrintingId) {
		const match = cardResult.printings.find((p) => p.id === input.cardPrintingId);
		if (match) return match.id;
	}

	let candidates = cardResult.printings;

	if (input.set && input.collectorNumber) {
		const exact = candidates.filter(
			(p) => p.setCode === input.set && p.collectorNumber === input.collectorNumber
		);
		if (exact.length > 0) candidates = exact;
	} else if (input.set) {
		const setMatches = candidates.filter((p) => p.setCode === input.set);
		if (setMatches.length > 0) candidates = setMatches;
	}

	if (input.finish) {
		const finishMatch = candidates.find((p) => p.finish === input.finish);
		if (finishMatch) return finishMatch.id;
	}

	if (candidates.length > 0) return candidates[0].id;
	if (cardResult.printings.length > 0) return cardResult.printings[0].id;
	return null;
}

type ResultSlot = { ok: true; value: ResolvedCardOutput } | { ok: false; error: string };

interface GroupEntry {
	key: string;
	inputs: Array<{ input: ResolveCardsInput; index: number }>;
}

// Bounded-concurrency map. Used to run the provider/DB work for unknown cards in
// parallel without hammering the provider limiter or the database connection pool.
async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker(): Promise<void> {
		for (;;) {
			const i = next++;
			if (i >= items.length) return;
			results[i] = await fn(items[i]);
		}
	}
	const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
	await Promise.all(workers);
	return results;
}

// Choose which provider card to store for an input. Mirrors the previous
// getCard(name, set, collectorNumber) behavior: prefer an exact set/collector
// match, then a set match, then any finish variant.
function pickVariant(variants: TcgCard[], input: ResolveCardsInput): TcgCard | null {
	if (input.set) {
		const setMatch = variants.find((c) => c.setCode === input.set);
		if (setMatch) {
			if (input.collectorNumber) {
				const exact = variants.find(
					(c) => c.setCode === input.set && c.collectorNumber === input.collectorNumber
				);
				if (exact) return exact;
			}
			if (input.finish) {
				const finishMatch = variants.find(
					(c) => c.setCode === input.set && c.finish === input.finish
				);
				if (finishMatch) return finishMatch;
			}
			return setMatch;
		}
	}
	if (input.finish) {
		const finishMatch = variants.find((c) => c.finish === input.finish);
		if (finishMatch) return finishMatch;
	}
	return variants[0] ?? null;
}

async function resolveUnknownGroups(
	gameSlug: string,
	gameId: string,
	groups: GroupEntry[],
	provider: TcgProvider,
	resultsByIndex: ResultSlot[]
): Promise<void> {
	// Deduplicate provider identifiers so identical rows are only fetched once.
	const identifiers: Array<{ name: string; set?: string; collectorNumber?: string }> = [];
	const seenIdentifiers = new Set<string>();
	for (const g of groups) {
		for (const { input } of g.inputs) {
			const id = { name: input.name, set: input.set, collectorNumber: input.collectorNumber };
			const key = `${id.name}\u0000${id.set ?? ''}\u0000${id.collectorNumber ?? ''}`;
			if (!seenIdentifiers.has(key)) {
				seenIdentifiers.add(key);
				identifiers.push(id);
			}
		}
	}

	// Batch-fetch from the provider (Scryfall POST /cards/collection batches 75).
	const fetched = await getCardsByIdentifiers(gameSlug, identifiers);
	const byName = new Map<string, TcgCard[]>();
	for (const card of fetched) {
		const key = provider.normalizeName(card.name);
		const list = byName.get(key);
		if (list) list.push(card);
		else byName.set(key, [card]);
	}

	// Fuzzy fallback for names the batch did not match. Keyed by the group key
	// because a fuzzy match's stored name can differ from the requested name.
	// Bounded so a large list of unknown names cannot blow the per-invocation
	// subrequest limit: beyond the cap, those cards resolve as not found.
	const FUZZY_CAP = 15;
	const fuzzyByName = new Map<string, TcgCard>();
	const fuzzyGroups = groups.filter((g) => !byName.has(g.key));
	await mapLimit(fuzzyGroups.slice(0, FUZZY_CAP), 5, async (g) => {
		const card = await provider.fuzzySearchCard(g.inputs[0].input.name);
		if (card) fuzzyByName.set(g.key, card);
	});

	// Build bulk upsert specs for every unknown group that has at least one
	// resolvable variant: one card per group (by normalized name) and one
	// printing per distinct (set, collector) requested.
	const cardSpecs: BulkCardSpec[] = [];
	const printingSpecs: BulkPrintingSpec[] = [];
	const resolvableGroups: GroupEntry[] = [];

	for (const g of groups) {
		const variants = byName.get(g.key) ?? (fuzzyByName.has(g.key) ? [fuzzyByName.get(g.key)!] : []);
		if (variants.length === 0) {
			for (const { input, index } of g.inputs) {
				resultsByIndex[index] = { ok: false, error: `Card not found: ${input.name}` };
			}
			continue;
		}
		resolvableGroups.push(g);

		const primary = pickVariant(variants, g.inputs[0].input) ?? variants[0];
		cardSpecs.push({
			key: g.key,
			name: primary.name,
			normalizedName: g.key,
			imageUrl: primary.imageUrl,
			typeLine: primary.typeLine,
			externalRefs: primary.externalRefs
		});

		const combos = new Map<string, TcgCard>();
		for (const { input } of g.inputs) {
			const comboKey = `${input.set ?? ''}|${input.collectorNumber ?? ''}`;
			if (!combos.has(comboKey)) combos.set(comboKey, pickVariant(variants, input) ?? variants[0]);
		}
		for (const [comboKey, variant] of combos) {
			printingSpecs.push({
				comboKey: `${g.key}__${comboKey}`,
				groupKey: g.key,
				printing: {
					id: variant.id,
					setCode: variant.setCode,
					setName: variant.setName,
					collectorNumber: variant.collectorNumber,
					rarity: variant.rarity,
					imageUrl: variant.imageUrl,
					language: variant.language,
					finish: variant.finish,
					factorySigned: variant.factorySigned,
					prices: variant.prices,
					externalRefs: variant.externalRefs
				}
			});
		}
	}

	if (resolvableGroups.length === 0) return;

	const { cards: cardIds, printings: printingIds } = await bulkEnsureCardsAndPrintings(
		gameId,
		cardSpecs,
		printingSpecs
	);

	for (const g of resolvableGroups) {
		const cardId = cardIds.get(g.key);
		if (!cardId) {
			for (const { input, index } of g.inputs) {
				resultsByIndex[index] = { ok: false, error: `Card not found: ${input.name}` };
			}
			continue;
		}

		const printings = printingSpecs
			.filter((ps) => ps.groupKey === g.key)
			.map((ps) => ({
				id: printingIds.get(ps.comboKey) as string,
				setCode: ps.printing.setCode,
				setName: ps.printing.setName,
				collectorNumber: ps.printing.collectorNumber,
				rarity: ps.printing.rarity,
				imageUrl: ps.printing.imageUrl,
				language: ps.printing.language,
				finish: ps.printing.finish,
				factorySigned: ps.printing.factorySigned,
				marketPriceUsd: ps.printing.prices.usd ? parseFloat(ps.printing.prices.usd) : null,
				marketPriceEur: ps.printing.prices.eur ? parseFloat(ps.printing.prices.eur) : null
			}));

		const lookup: CardLookupResult = {
			id: cardId,
			name: cardSpecs.find((c) => c.key === g.key)?.name ?? g.inputs[0].input.name,
			normalizedName: g.key,
			imageUrl: null,
			gameData: {},
			printings
		};

		for (const { input, index } of g.inputs) {
			const resolvedPrintingId = resolvePrinting(lookup, input);
			if (!resolvedPrintingId) {
				resultsByIndex[index] = { ok: false, error: `No printing found for: ${input.name}` };
				continue;
			}
			const printing = lookup.printings.find((p) => p.id === resolvedPrintingId);
			resultsByIndex[index] = {
				ok: true,
				value: {
					cardId: lookup.id,
					cardName: lookup.name,
					printingId: resolvedPrintingId,
					setCode: printing?.setCode ?? null,
					collectorNumber: printing?.collectorNumber ?? null,
					qty: input.qty,
					index
				}
			};
		}
	}
}

export async function resolveCards(
	gameSlug: string,
	cards: ResolveCardsInput[],
	gameId?: string
): Promise<{ resolved: ResolvedCardOutput[]; errors: string[] }> {
	const resolved: ResolvedCardOutput[] = [];
	const errors: string[] = [];

	if (cards.length === 0) return { resolved, errors };

	const provider = getProvider(gameSlug);

	// Resolve the game id once. Callers that already have it (e.g. the save
	// endpoint) pass it in to avoid a redundant subrequest.
	let effectiveGameId = gameId;
	if (!effectiveGameId) {
		const { data: game } = await getSupabase()
			.from('games')
			.select('id')
			.eq('slug', gameSlug)
			.maybeSingle();
		effectiveGameId = game?.id;
	}

	if (!effectiveGameId) {
		// Mirrors the previous per-card behavior: every card fails to resolve.
		for (const card of cards) errors.push(`Card not found: ${card.name}`);
		return { resolved, errors };
	}

	// Group inputs by normalized name, preserving first-occurrence order.
	const groups: GroupEntry[] = [];
	const byKey = new Map<string, GroupEntry>();
	for (let i = 0; i < cards.length; i++) {
		const input = cards[i];
		const key = provider.normalizeName(input.name);
		let g = byKey.get(key);
		if (!g) {
			g = { key, inputs: [] };
			byKey.set(key, g);
			groups.push(g);
		}
		g.inputs.push({ input, index: i });
	}

	// Resolve every card already in the database with batched queries instead of
	// one round trip per card. Chunked to keep request URLs small.
	const names = Array.from(byKey.keys());
	const knownByName = new Map<string, CardLookupResult>();
	const CHUNK = 50;
	const chunkResults = await Promise.all(
		Array.from({ length: Math.ceil(names.length / CHUNK) }, (_, i) =>
			getSupabase()
				.from('cards')
				.select('*, card_printings(*)')
				.in('normalized_name', names.slice(i * CHUNK, (i + 1) * CHUNK))
				.eq('game_id', effectiveGameId)
		)
	);
	for (const { data: rows } of chunkResults) {
		for (const row of (rows || []) as Array<Record<string, unknown>>) {
			knownByName.set(row.normalized_name as string, cardRowToLookupResult(row));
		}
	}

	const resultsByIndex = new Array<ResultSlot>(cards.length);
	const unknownGroups: GroupEntry[] = [];

	for (const g of groups) {
		const lookup = knownByName.get(g.key);
		if (!lookup) {
			unknownGroups.push(g);
			continue;
		}
		for (const { input, index } of g.inputs) {
			const resolvedPrintingId = resolvePrinting(lookup, input);
			if (!resolvedPrintingId) {
				resultsByIndex[index] = { ok: false, error: `No printing found for: ${input.name}` };
				continue;
			}
			const printing = lookup.printings.find((p) => p.id === resolvedPrintingId);
			resultsByIndex[index] = {
				ok: true,
				value: {
					cardId: lookup.id,
					cardName: lookup.name,
					printingId: resolvedPrintingId,
					setCode: printing?.setCode ?? null,
					collectorNumber: printing?.collectorNumber ?? null,
					qty: input.qty,
					index
				}
			};
		}
	}

	if (unknownGroups.length > 0) {
		await resolveUnknownGroups(gameSlug, effectiveGameId, unknownGroups, provider, resultsByIndex);
	}

	for (let i = 0; i < resultsByIndex.length; i++) {
		const slot = resultsByIndex[i];
		if (!slot) {
			errors.push(`Card not found: ${cards[i].name}`);
			continue;
		}
		if (slot.ok) resolved.push(slot.value);
		else errors.push(slot.error);
	}

	return { resolved, errors };
}
