import { z } from 'zod/v4';

export const CardEntrySchema = z.object({
	name: z.string().min(1).max(256),
	qty: z.number().int().min(1).max(99999),
	set: z.string().max(32).optional(),
	collector_number: z.string().max(32).optional(),
	imageUrl: z.string().url().max(2048).nullable().optional(),
	manaCost: z.string().max(64).nullable().optional(),
	cardPrintingId: z.string().nullable().optional(),
	condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
	finish: z.string().max(32).nullable().optional(),
	aftermarketSigned: z.boolean().optional(),
	isAltered: z.boolean().optional(),
	language: z.string().max(8).nullable().optional(),
	isTradeable: z.boolean().optional(),
	location: z.string().max(128).nullable().optional(),
	notes: z.string().max(1024).nullable().optional()
});

export const SaveWishlistSchema = z.object({
	cards: z.array(CardEntrySchema).min(1).max(500),
	creatorFingerprint: z.string().max(256).optional(),
	ownerName: z.string().max(128).nullable().optional(),
	gameSlug: z.enum(['mtg', 'pokemon', 'riftbound']).default('mtg')
});

export const SaveCollectionSchema = z.object({
	cards: z.array(CardEntrySchema).min(1).max(5000),
	gameSlug: z.enum(['mtg', 'pokemon', 'riftbound']).default('mtg')
});

export const PriceRequestSchema = z.object({
	cards: z
		.array(
			z.object({
				name: z.string().min(1).max(256),
				set: z.string().max(32).optional(),
				collector_number: z.string().max(32).optional(),
				cardPrintingId: z.string().optional(),
				finish: z.string().max(32).optional()
			})
		)
		.min(1)
		.max(500),
	gameSlug: z.enum(['mtg', 'pokemon', 'riftbound']).default('mtg')
});

export const DeleteWishlistSchema = z.object({
	id: z.string().length(10),
	fingerprint: z.string().max(256)
});

export const TradeItemSchema = z.object({
	userCardId: z.string().uuid(),
	quantity: z.number().int().min(1).max(99999)
});

export const TradeProposalSchema = z.object({
	recipientId: z.string().uuid(),
	offeredItems: z.array(TradeItemSchema).min(1).max(200),
	requestedItems: z.array(TradeItemSchema).max(200).default([]),
	note: z.string().max(2000).optional()
});

export const MessageSchema = z.object({
	recipientId: z.string().uuid(),
	tradeId: z.string().uuid().optional(),
	subject: z.string().max(256).optional(),
	body: z.string().min(1).max(5000)
});

export const CollectionLookupSchema = z.object({
	cardName: z.string().min(1).max(256),
	exact: z.boolean().default(false)
});

export type SaveWishlistInput = z.infer<typeof SaveWishlistSchema>;
export type SaveCollectionInput = z.infer<typeof SaveCollectionSchema>;
export type TradeProposalInput = z.infer<typeof TradeProposalSchema>;
