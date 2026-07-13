# Trades Are Bilateral Only

A Trade is a negotiation between exactly two named participants from the moment of creation. `proposer_id` and `recipient_id` are both non-null, and the alternating-offers rule (Q3/A) and the cancel-anytime rule (Q5/A) both assume this — every offer has a clear "other party" who is the only person allowed to respond, and either participant knows who they can cancel on.

"Open offers" — broadcast intents like "I have 4 Bolts and want any Sol Ring, anyone interested?" — are a real feature on some trade platforms, but they require a different domain model: a broadcast intent, a claim or bid mechanism, a coordination problem if multiple users accept, and an expiration policy. They also break the alternation rule (whose turn is it when no recipient has claimed the trade yet?).

If broadcast trade discovery is ever built, it should be a separate concept with its own glossary entry and its own table — not an extension of `Trade` with a nullable `recipient_id` and an "open" status. Conversion to a bilateral Trade happens at the moment a single recipient claims the open offer.

This decision is recorded because making Trade do both jobs (bilateral negotiation + broadcast intent) is hard to reverse once the schema, RLS, and offer-creation code accommodate nullable recipients and pre-claim states. A future reader might expect "open offers" to be a natural extension of Trade and wonder why the model forces a specific counterparty from creation.
