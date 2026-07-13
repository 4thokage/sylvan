# Auth and RLS Use Clerk JWT, No Service Role Key

The server no longer stores or uses `SUPABASE_SERVICE_ROLE_KEY`. All database access from application code goes through the Supabase anon key, and Row Level Security (RLS) policies enforce who can read or write each row. Complex operations that legitimately cross ownership boundaries (trade lifecycle, anonymous wishlist management) are performed through `security definer` RPC functions, never by elevating the whole connection to a service role.

The Supabase `current_user_id()` helper extracts the user's identity from the JWT passed in the `Authorization` header: `auth.jwt() ->> 'sub'`. Because Sylvan uses Clerk for authentication, that `sub` is the Clerk user ID. The project is configured so that Supabase accepts Clerk session tokens as valid JWTs.

On the server, `src/lib/server/supabase.ts` keeps a global anonymous client for code that runs outside a request, and exposes `createAuthSupabase(token)` plus `runWithSupabase(client, fn)`. `src/hooks.server.ts` creates a request-scoped client from the Clerk session token and runs the rest of the request inside an `AsyncLocalStorage` context, so any code calling `getSupabase()` receives the authenticated client for that request. This avoids threading a client through every function signature while still giving each request its own credentials.

The trade-off is that every RLS policy and every RPC must be explicit about identity: no operation can silently bypass the user's permissions by falling back to a service role. The benefit is defense in depth — even if a route handler has a bug, the database layer still enforces the ownership rules.

This decision is recorded because it changes how the whole backend connects to Supabase, and because reintroducing a service role key later would quietly defeat RLS.
