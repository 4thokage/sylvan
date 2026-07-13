# External Identity Mapping Uses `identifier_type`

Provider IDs are stored in `card_external_refs` and `printing_external_refs`. The original schema used only `provider_slug` and `external_id`, which broke down when a single provider exposed more than one namespace for the same card or printing — for example, Scryfall has both `oracle_id` (card-level) and `scryfall_id` (printing-level), and Riftbound has `riftbound_id` and `riftbound_card_id`.

The current schema adds `identifier_type` to both external-reference tables. A reference is now unique on `(provider_slug, identifier_type, external_id)`, so one provider can contribute multiple identifiers without collisions.

This lets the import and matching layers choose the right identifier for the job:

- `oracle_id` is used to deduplicate the abstract card identity.
- `scryfall_id` identifies a specific printing.
- Provider-specific printing IDs identify a specific physical release when no cross-provider oracle ID exists.

The trade-off is a slightly wider table and the need for adapters to declare which identifier type they are emitting. The benefit is correct multi-provider, multi-game identity mapping: a card can have several external IDs from the same source, and the matcher can compare the appropriate namespace.

This decision is recorded because it affects every provider adapter, the import pipeline, and any future integration with new card databases.
