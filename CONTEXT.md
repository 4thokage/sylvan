# Sylvan

A multi-TCG collection and trade matching platform.

## Language

**Haves (Collection)**:
Cards a signed-in user owns. Default available for trade matching, but each entry has an `is_tradeable` flag to opt out. Each entry is one or more Have Stacks, which reference `card_printings.id` (and through it `cards.id` for the identity layer) and carry physical/instance attributes. Trade offers reference a Have Stack and a quantity from it.
_Avoid_: Inventory, binder, display

**Card**:
A canonical card identity (e.g., "Black Lotus") representing the abstract concept, not any specific printing. Stored in the `cards` table with a surrogate UUID `id`. Uses `oracle_id` as a game-specific external reference (Scryfall for MTG). This is the matching layer — Wishlist items and collection entries reference `cards.id`.
_Avoid_: Scryfall ID, card name (as key)

**Have Stack**:
A homogeneous stack of physically identical cards a user owns — one `user_cards` row (`user_card_id`). References `card_printings.id` for the printing and carries a `quantity` plus shared physical-state attributes (condition, aftermarket-signed, altered). Identity attributes (Language, Finish, factory-signed) are inherited from the Printing, not stored on the stack. A stack is not a single card; it is N cards that share the same printing and physical state. This is the fulfillment layer — trade offers reference a Have Stack and a quantity from it, not card identities.
_Avoid_: Card instance, collection entry, user card, stack (ambiguous outside "Have Stack")

**Finish**:
The physical treatment of a Printing's surface — non-foil, foil, foil-etched, holo, reverse-holo, etc. A Printings attribute, not a Have Stack attribute: each Finish variant of a set/collector-number is a distinct Printing row with its own price. Providers that bundle multiple finishes into one card object are normalized during import so that every Printing row has exactly one Finish.
_Avoid_: Foil (as a boolean), treatment, coating

**Printing (CardPrinting)**:
A specific set/collector-number release of a Card in a specific Language at a specific Finish. `card_printings` table carrying factory-printed identity: `card_id` (FK), `set_code`, `collector_number`, `rarity`, `language`, `finish`, prices. Links the abstract Card identity to a concrete physical version. Providers that expose multiple finishes or languages per card object are normalized into one Printing row per (Language, Finish) during import.
_Avoid_: Version, variant

**Wishlist**:
Cards a user is looking for. Shareable via short URL. Can be created signed-in or anonymously. Each item references a Card, and when the user specifies physical requirements (printing, condition, foil, etc.) those become filters — the matcher only surfaces Have Stacks satisfying the populated attributes. Unspecified attributes broaden the match.
_Avoid_: Wants, needs, desires

**Anonymous Session**:
A device-fingerprinted identity with no `users` row. Can create Wishlists and use scanning/proxy tools. Cannot have Haves or participate in trade matching.
_Avoid_: Guest, visitor

**Trade**:
A negotiation between two users to exchange cards. Has a status lifecycle: `pending -> accepted | rejected | cancelled`. The proposer creates the initial TradeOffer, then either participant alternates new offers until someone accepts or rejects. Accept and reject are responses to the current offer (available to the participant who did not create it); cancel is an exit by either participant at any time.
_Avoid_: Deal, exchange

**TradeOffer**:
An immutable snapshot of a proposed exchange within a Trade. Contains offered and requested card items. Either participant may create a new offer on a pending trade, but only the participant who did not create the current offer may respond — offers alternate. The Trade points to the current offer via `current_offer_id`.
_Avoid_: Counter-offer (all offers are the same kind, not a special "counter" type)

**Trade Rating**:
One participant's evaluation of the other following a completed Trade. One rating per rater per trade. Reputation is derived from Ratings, not stored directly.
_Avoid_: Review, feedback, reputation, rep, karma

**Block**:
A directional, unilateral decision by one user (the blocker) to restrict interactions with another (the blocked). Blocking hides both users from each other in matching, prevents either from creating new Trades with the other, and prevents new Messages between them. Existing Trade history and past Messages remain visible. Blocking is asymmetric: A blocks B does not imply B blocks A.
_Avoid_: Blacklist, ignore, mute, ban

**Message**:
Communication between two users, optionally associated with a Trade. No separate lifecycle of its own beyond sent and read state.
_Avoid_: Chat, conversation, thread, DM
