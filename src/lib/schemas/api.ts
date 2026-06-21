import { z } from 'zod/v4';

export const CardEntrySchema = z.object({
  name: z.string().min(1).max(256),
  qty: z.number().int().min(1).max(99999),
  set: z.string().max(32).optional(),
  collector_number: z.string().max(32).optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  manaCost: z.string().max(64).nullable().optional(),
  oracleId: z.string().max(64).nullable().optional(),
  selectedPrintIndex: z.number().int().min(0).nullable().optional()
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
  cards: z.array(
    z.object({
      name: z.string().min(1).max(256),
      set: z.string().max(32).optional(),
      collector_number: z.string().max(32).optional(),
      selectedPrintIndex: z.number().int().min(0).optional()
    })
  ).min(1).max(500),
  gameSlug: z.enum(['mtg', 'pokemon', 'riftbound']).default('mtg')
});

export const DeleteWishlistSchema = z.object({
  id: z.string().length(10),
  fingerprint: z.string().max(256)
});

export const TradeProposalSchema = z.object({
  recipientId: z.string().uuid(),
  offeredCardIds: z.array(z.string().uuid()).min(1).max(200),
  requestedCardIds: z.array(z.string().uuid()).min(1).max(200),
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
