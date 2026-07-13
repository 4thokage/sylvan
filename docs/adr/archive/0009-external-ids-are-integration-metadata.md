# External IDs Are Integration Metadata, Not Domain Identity

`oracle_id` (Scryfall's stable card-level identifier) was a named column on `cards`. This violated the principle that the canonical model describes trading — what card is this, what printings exist, who owns it, who wants it — not integration. Only the importer, adapter, and sync logic care about upstream provider identifiers; the trading domain never consults them.

A genericized single column (`external_id`) doesn't scale. Six months in, with Scryfall, MTGJSON, Archidekt, Pokémon TCG API, and Limitless all providing card data, "which one is `external_id`?" has no correct answer. The first one? The preferred one? The last imported? There's no universal choice.

The canonical model strips MTG bias from `cards` and `card_printings` entirely. Two external-ref tables mirror the domain's two layers:

- `card_external_refs(card_id, provider_slug, external_id)` — card-level references like Scryfall's `oracle_id` (groups printings under one card).
- `printing_external_refs(printing_id, provider_slug, external_id)` — printing-level references like Scryfall's `id`, Pokémon TCG API's `id`, MTGJSON's `uuid`.

Both tables are adapter-only: populated during import, consulted for deduplication and sync, never read by the matcher, trade lifecycle, or any user-facing query path. No polymorphic `entity_type` column — two distinct tables keep the domain's card-vs-printing split explicit downstream.

This decision is recorded because striking `oracle_id` from `cards` and replacing it with a cross-table lookup is hard to reverse (touches every adapter and the import path) and surprising without context — a reader seeing no `oracle_id` column on `cards` after seeing it in the original schema might wonder how upstream identity is tracked. The answer: it isn't, in the domain; it's tracked by the adapter in a separate table.
