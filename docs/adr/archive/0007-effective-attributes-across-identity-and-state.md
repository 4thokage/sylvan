# Effective Attributes: Matching Across Identity and State Layers

# Effective Attributes: Matching Across Identity and State Layers

ADR-0006 separates factory-printed identity (Printing) from physical state (Have Stack). Some attributes straddle both layers — `signed` is the canonical example. A card factory-signed at manufacture (Pokémon autograph promo, MTG artist proof) is a Printing attribute; a card signed aftermarket by the owner is a Have Stack attribute.

The matcher does not force users to know which layer holds the truth. A wishlist filter `is_signed = true` means "the physical card is signed, however it got that way." The matcher computes an effective attribute by joining both layers:

```
effective_is_signed = printing.factory_signed OR stack.aftermarket_signed
```

This is not duplicated storage. Each fact has exactly one canonical home: factory-signed lives on the Printing, aftermarket-signed lives on the Have Stack. The matcher composes them at query time — the same way a SQL query joins two tables.

Column naming reflects the distinction: `card_printings.factory_signed` and `user_cards.aftermarket_signed` (not `is_signed` on either), so the single-name `is_signed` is reserved for the effective attribute exposed to the matcher and UI.

## Scope: signed only, not a general pattern

The effective-attribute pattern applies to `signed` and **not** to `altered`. Official alternate-art variants (Zendikar full-art basics, Secret Lair alt-arts, Pokémon illustration rares) are factory-produced and live as distinct Printing rows. Aftermarket alterations (owner-modified artwork) live on the Have Stack. These are genuinely different concepts — "official alternate version" is not the same intent as "card someone modified after production," so users filter them separately. A wishlist that wants either must create separate items. The same applies to catalogued factory errors (miscuts with price-guide entries): they are distinct Printings, not stack attributes. Random factory defects on otherwise-normal printings are reflected in stack condition or descriptive notes, not new Printing rows.

This scoping is recorded because the effective-attribute pattern is tempting to generalize, and a future developer might assume `altered` follows `signed`. The reason it doesn't: `signed` is one intent with two origins, while `altered` is two intents. The factory-vs-aftermarket test identifies where data lives; whether a filter composes across layers depends on whether the two origins express the same user intent.
