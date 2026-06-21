-- Phase 1.5: Trade matching performance + anonymous upgrade support

-- 1. Materialized view: flattened user cards for fast trade matching
create materialized view if not exists public.user_cards_flat as
select
  u.id as user_id,
  u.clerk_user_id,
  lower(uc.card_name) as card_name,
  uc.quantity,
  uc.is_public
from public.users u
join public.user_cards uc on uc.user_id = u.id
where uc.quantity > 0;

create unique index if not exists idx_user_cards_flat_row
  on public.user_cards_flat(user_id, card_name);

create index if not exists idx_user_cards_flat_card
  on public.user_cards_flat(card_name);

-- 2. Function to refresh the materialized view
create or replace function public.refresh_user_cards_flat()
returns trigger
language plpgsql
as $$
begin
  refresh materialized view concurrently public.user_cards_flat;
  return null;
end;
$$;

-- 3. Trigger to auto-refresh when user_cards changes
-- Note: concurrent refresh requires the unique index above
create trigger trg_refresh_user_cards_flat
after insert or update or delete on public.user_cards
for each statement
execute function public.refresh_user_cards_flat();

-- 4. Index on wishlist_items.card_name for fast reverse matching
create index if not exists idx_wishlist_items_card_name
  on public.wishlist_items(card_name);

-- 5. Index on user_cards.card_name for fast user collection lookups
create index if not exists idx_user_cards_name
  on public.user_cards(card_name);

-- 6. Anonymous session upgrade support
-- Add fingerprint to user_cards for linking anonymous collections
alter table public.user_cards
  add column if not exists session_fingerprint text;

create index if not exists idx_user_cards_fingerprint
  on public.user_cards(session_fingerprint);

-- 7. Function to merge anonymous collection into registered user
create or replace function public.merge_anonymous_collection(
  p_fingerprint text,
  p_clerk_user_id text
)
returns void
language plpgsql
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from public.users
  where clerk_user_id = p_clerk_user_id;

  if v_user_id is null then
    raise exception 'User not found for clerk_user_id: %', p_clerk_user_id;
  end if;

  -- Merge quantities where card_name matches
  with existing as (
    select card_name, quantity
    from public.user_cards
    where user_id = v_user_id
  ),
  anon as (
    select lower(card_name) as card_name, quantity
    from public.user_cards
    where session_fingerprint = p_fingerprint
      and user_id is null
  )
  update public.user_cards uc
  set quantity = uc.quantity + anon.quantity,
      session_fingerprint = null,
      updated_at = now()
  from anon
  where uc.user_id = v_user_id
    and lower(uc.card_name) = anon.card_name;

  -- Insert new cards from anonymous that don't exist in user's collection
  insert into public.user_cards (user_id, card_name, quantity, is_public, session_fingerprint)
  select
    v_user_id,
    anon.card_name,
    anon.quantity,
    true,
    null
  from (
    select lower(card_name) as card_name, quantity
    from public.user_cards
    where session_fingerprint = p_fingerprint
      and user_id is null
  ) anon
  where not exists (
    select 1 from public.user_cards uc
    where uc.user_id = v_user_id
      and lower(uc.card_name) = anon.card_name
  );

  -- Delete the now-migrated anonymous cards
  delete from public.user_cards
  where session_fingerprint = p_fingerprint
    and user_id is null;

  -- Link user_sessions to the registered user
  update public.user_sessions
  set user_id = v_user_id
  where fingerprint = p_fingerprint;
end;
$$;
