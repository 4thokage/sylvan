# Anonymous Sessions are Ephemeral and Capability-Limited

Anonymous users (device-fingerprinted, no `users` row) can create shareable Wishlists and use scanning/proxy tools, but cannot own Haves (collection entries) or participate in trade matching. A `user_sessions` table maps fingerprints to optional `user_id` for the upgrade flow, but the fingerprint alone is not treated as durable ownership.

Requiring signup for Haves and trades anchors ownership to a recoverable identity (Clerk), without which trade disputes, account recovery, and card value claims would be unmanageable. The ephemeral Wishlist-only tier preserves a low-friction entry point while keeping the liability-bearing parts of the system behind authentication.
