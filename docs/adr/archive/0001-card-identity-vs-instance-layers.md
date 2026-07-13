# Card Identity vs Instance Layers

Sylvan needs to match trades at the _card level_ ("I want a Black Lotus") but fulfill them at the _physical instance level_ ("I'll give you my NM Unlimited Black Lotus"). Storing everything as a single entity (e.g., `user_cards` with `card_name`) breaks real-world accuracy and matching quality simultaneously.

We split the model into three tables: `cards` (abstract identity, FK target for wishlists and matching), `card_printings` (specific set/collector-number release), and `user_cards` (physical instances owned by users, referencing `card_printings` and carrying condition/foil/etc). Trade offer items reference `user_card_id` — the instance layer — so every offer is grounded in real physical cards.
