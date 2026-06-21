# Sylvan

A multi-TCG collection and trade matching platform.

## Language

**Haves (Collection)**:
Cards a signed-in user owns. Default available for trade matching, but each entry has an `is_tradeable` flag to opt out. Each entry references `cards.id` for the identity layer and carries physical/instance attributes. Trade offers reference `user_card_id` for the instance layer.
_Avoid_: Inventory, binder, display

**Card**:
A canonical card identity (e.g., "Black Lotus") representing the abstract concept, not any specific printing. Stored in the `cards` table with a surrogate UUID `id`. Uses `oracle_id` as a game-specific external reference (Scryfall for MTG). This is the matching layer — Wishlist items and collection entries reference `cards.id`.
_Avoid_: Scryfall ID, card name (as key)

**Card Instance**:
A specific physical card entry a user owns (`user_card_id`). References `card_printings.id` for the printing and carries instance attributes: condition, foil, signed, altered, language. This is the fulfillment layer — trade offers reference instances, not card identities.
_Avoid_: Collection entry, user card

**Printing (CardPrinting)**:
A specific set/collector-number release of a Card. `card_printings` table with `card_id` (FK), `set_code`, `collector_number`, `rarity`, prices. Links the abstract Card identity to a concrete physical version.
_Avoid_: Version, variant

**Wishlist**:
Cards a user is looking for. Shareable via short URL. Can be created signed-in or anonymously.
_Avoid_: Wants, needs, desires

**Anonymous Session**:
A device-fingerprinted identity with no `users` row. Can create Wishlists and use scanning/proxy tools. Cannot have Haves or participate in trade matching.
_Avoid_: Guest, visitor

**Trade**:
A negotiation between two users to exchange cards. Has a status lifecycle: `pending → accepted | rejected | cancelled`. The proposer creates the initial `TradeOffer` (immutable snapshot).
_Avoid_: Deal, exchange

**TradeOffer**:
An immutable snapshot of a proposed exchange within a Trade. Contains offered and requested card items. The Trade points to the current offer via `current_offer_id`.
_Avoid_: Counter-offer (all offers are the same kind, not a special "counter" type)
