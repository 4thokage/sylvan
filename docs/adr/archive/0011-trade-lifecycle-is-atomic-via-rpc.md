# Trade Lifecycle Is Atomic and Runs Through Supabase RPCs

Creating a trade, countering an offer, accepting/rejecting an offer, and cancelling a trade all mutate multiple tables and must stay consistent. They also cross user boundaries: a trade decrements Have Stacks owned by one participant and affects records owned by another. Instead of implementing this in TypeScript with multiple round-trips and optimistic locking, the lifecycle is implemented inside four `security definer` PostgreSQL functions:

- `create_trade`
- `create_counter_offer`
- `respond_to_offer`
- `cancel_trade`

Each function validates the caller, enforces the alternation rule (only the participant who did not create the current offer may respond), checks block status, verifies stack availability with `available_quantity()`, and acquires `FOR UPDATE` row locks on the affected Have Stacks before changing quantities or deleting empty stacks. All mutations for one lifecycle step happen in a single transaction.

The trade-off is that more business logic lives in SQL, which is harder to unit-test in isolation and requires a schema migration to change. The benefit is atomicity: a trade cannot partially reserve cards, and the application layer cannot accidentally leave the database in an inconsistent state. It also lets RLS stay restrictive — the RPC runs as the definer, so cross-participant writes are explicit and auditable rather than requiring broad update permissions.

This decision is recorded because the alternative (application-level coordination with service role or loosened RLS) was the source of several bugs, including missing imports and race conditions in the original trade endpoints.
