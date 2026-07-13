# Alternating Offers with Cancel-Anytime

Either participant in a pending trade may create a new offer, but only the participant who did not create the current offer may respond to it — offers alternate. Any participant may cancel a pending trade at any time, regardless of whose turn it is. Trade lifecycle has three terminal states with distinct intent: `accepted` (both agreed, trade completed), `rejected` (the non-offerer declined the current offer), and `cancelled` (either participant withdrew the negotiation).

The previous code restricted follow-up offers to the recipient only (one counter, then done), which contradicted the glossary's "all offers are the same kind" principle and made multi-round negotiation impossible. Alternating offers restores multi-round haggling with a single rule whose turn it is.

Cancel-anytime was chosen over alternatives (cooldown timers, only-the-non-offerer-can-cancel) because the primary failure mode is a ghosted participant, not adversarial racing. A cooldown would require a clock source, UI for the timer, and complex edge cases, all to mitigate a rare griefing pattern. The escape valve for "the other person stopped responding" is essential and must be symmetric.

This decision is recorded because the alternation rule and the cancel-anytime rule are both hard to reverse (they shape the entire offer-creation surface, the reservation release paths, and the UI) and surprising without context — a reader might expect either strict turn-taking with no escape, or free-for-all offer creation, and would wonder why this specific compromise.
