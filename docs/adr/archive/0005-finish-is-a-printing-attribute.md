# Finish is a Printing Attribute, Normalized per Provider

Finish (non-foil, foil, foil-etched, holo, reverse-holo, etc.) lives on `card_printings`, not on `user_cards`. Each Finish variant of a set/collector-number is a distinct Printing row with its own price. A Have Stack inherits its Finish from its Printing — the stack carries only instance-level attributes that the printing cannot capture (condition, signed, altered, language).

This replaces the previous `is_foil` boolean on both `card_printings` and `user_cards`, which was never populated on the printing side and duplicated on the stack side, creating a contradiction: if both columns disagreed, the matcher wouldn't know which to trust.

Providers structure finish differently. Scryfall returns one card object with both foil and non-foil prices. Pokémon's TCG API splits variants (holo, reverse-holo) into separate card objects. Rather than accommodating both shapes polymorphically, all providers normalize to the same model during import: every Printing row has exactly one Finish and one price. For Scryfall, this means synthesizing two printing rows from one API response — one with `finish = 'non-foil'` and the non-foil price, one with `finish = 'foil'` and the foil price. For Pokémon, the existing per-variant split maps directly.

The trade-off is a one-time cost: MTG import becomes heavier (row synthesis), and existing collection data needs reprocessing against the split printings. The permanent benefit is a single canonical place for finish, one matcher path, and prices that are always finish-specific.

This decision is recorded because changing where finish lives touches import, matching, wishlist filtering, and every provider adapter — reversing it later would be expensive. A reader seeing split printings for MTG (when Scryfall combines them) might assume the split was accidental rather than deliberate.
