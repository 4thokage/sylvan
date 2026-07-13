-- Sylvan consolidated schema (squashed from 00001-00007).
-- Sylvan Web: Initial Schema
-- Clean single migration for pre-production reset.
-- Aligned with ADRs 0001-0009 plus auth (0010), trade RPC (0011), and external identity mapping (0013).

-- 0. Extensions
create extension if not exists pg_trgm;

-- 1. Games (MTG, Pokémon, Riftbound, etc.)
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz default now()
);

insert into public.games (slug, name) values
  ('mtg', 'Magic: The Gathering'),
  ('pokemon', 'Pokémon TCG'),
  ('riftbound', 'Riftbound')
on conflict (slug) do nothing;

-- 2. Users
create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  clerk_user_id     text unique not null,
  username          text unique,
  is_admin          boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_users_clerk on public.users(clerk_user_id);

-- 3. Cards (abstract identity layer)
create table if not exists public.cards (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid references public.games(id) not null,
  name            text not null,
  normalized_name text not null,
  image_url       text,
  game_data       jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  unique (game_id, normalized_name)
);

create index if not exists idx_cards_game on public.cards(game_id);
create index if not exists idx_cards_name_trgm on public.cards using gin(normalized_name gin_trgm_ops);

-- 4. Card Printings (factory-printed identity layer)
create table if not exists public.card_printings (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid references public.cards(id) not null,
  game_id           uuid references public.games(id) not null,
  set_code          text not null,
  set_name          text not null,
  collector_number  text,
  rarity            text,
  language          text not null default 'en',
  finish            text not null default 'non-foil',
  factory_signed    boolean not null default false,
  image_url         text,
  market_price_usd  decimal(12,2),
  market_price_eur  decimal(12,2),
  last_price_update timestamptz,
  created_at        timestamptz default now(),
  unique (game_id, set_code, collector_number, language, finish, factory_signed)
);

create index if not exists idx_printings_card on public.card_printings(card_id);
create index if not exists idx_printings_set on public.card_printings(set_code);
create index if not exists idx_printings_game on public.card_printings(game_id);
create index if not exists idx_printings_lookup on public.card_printings(game_id, set_code, collector_number, language, finish, factory_signed);

-- 5. External Identity Refs (integration metadata only)
create table if not exists public.card_external_refs (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid references public.cards(id) on delete cascade not null,
  provider_slug     text not null,
  identifier_type   text not null,
  external_id       text not null,
  created_at        timestamptz default now(),
  unique (provider_slug, identifier_type, external_id)
);

create index if not exists idx_card_refs_card on public.card_external_refs(card_id);
create index if not exists idx_card_refs_lookup on public.card_external_refs(provider_slug, identifier_type, external_id);

create table if not exists public.printing_external_refs (
  id                uuid primary key default gen_random_uuid(),
  printing_id       uuid references public.card_printings(id) on delete cascade not null,
  provider_slug     text not null,
  identifier_type   text not null,
  external_id       text not null,
  created_at        timestamptz default now(),
  unique (provider_slug, identifier_type, external_id)
);

create index if not exists idx_printing_refs_printing on public.printing_external_refs(printing_id);
create index if not exists idx_printing_refs_lookup on public.printing_external_refs(provider_slug, identifier_type, external_id);

-- 6. User Cards / Have Stacks (physical state layer)
create table if not exists public.user_cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id) not null,
  card_printing_id  uuid references public.card_printings(id) not null,
  quantity          integer not null default 1 check (quantity >= 0),
  condition         text not null default 'NM' check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  aftermarket_signed boolean not null default false,
  is_altered        boolean not null default false,
  is_tradeable      boolean not null default true,
  location          text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (user_id, card_printing_id, condition, aftermarket_signed, is_altered)
);

create index if not exists idx_user_cards_user on public.user_cards(user_id);
create index if not exists idx_user_cards_printing on public.user_cards(card_printing_id);
create index if not exists idx_user_cards_user_game on public.user_cards(user_id, card_printing_id);

-- 7. Wishlists
create table if not exists public.wishlists (
  id                  text primary key,
  user_id             uuid references public.users(id),
  game_id             uuid references public.games(id),
  title               text,
  owner_name          text,
  creator_fingerprint text,
  visibility          text not null default 'public' check (visibility in ('public', 'private')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_wishlists_user on public.wishlists(user_id);
create index if not exists idx_wishlists_visibility on public.wishlists(visibility);
create index if not exists idx_wishlists_fingerprint on public.wishlists(creator_fingerprint);

-- 8. Wishlist Items (card identity + optional physical filters)
create table if not exists public.wishlist_items (
  id                uuid primary key default gen_random_uuid(),
  wishlist_id       text references public.wishlists(id) on delete cascade not null,
  card_id           uuid references public.cards(id) not null,
  card_printing_id  uuid references public.card_printings(id),
  quantity          integer not null default 1 check (quantity > 0),
  condition         text check (condition is null or condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  finish            text,
  aftermarket_signed boolean,
  is_altered        boolean,
  language          text,
  created_at        timestamptz default now()
);

create index if not exists idx_wishlist_items_wishlist on public.wishlist_items(wishlist_id);
create index if not exists idx_wishlist_items_card on public.wishlist_items(card_id);
create index if not exists idx_wishlist_items_printing on public.wishlist_items(card_printing_id);

-- 9. Trades (bilateral only)
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  proposer_id     uuid references public.users(id) not null,
  recipient_id    uuid references public.users(id) not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  current_offer_id uuid,
  proposer_note   text,
  recipient_note  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  completed_at    timestamptz,
  check (proposer_id <> recipient_id)
);

create index if not exists idx_trades_proposer on public.trades(proposer_id);
create index if not exists idx_trades_recipient on public.trades(recipient_id);
create index if not exists idx_trades_status on public.trades(status);
create index if not exists idx_trades_participants on public.trades(proposer_id, recipient_id, status);

-- 10. Trade Offers (immutable snapshots)
create table if not exists public.trade_offers (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade not null,
  offered_by      uuid references public.users(id) not null,
  note            text,
  created_at      timestamptz default now()
);

create index if not exists idx_trade_offers_trade on public.trade_offers(trade_id);

-- Add current_offer_id to trades (circular FK, must come after trade_offers)
alter table public.trades
  add constraint fk_trades_current_offer
  foreign key (current_offer_id) references public.trade_offers(id);

create index if not exists idx_trades_current_offer on public.trades(current_offer_id);

-- 11. Trade Offer Items (reference a slice of a Have Stack; no side column — direction derived from offer ownership)
create table if not exists public.trade_offer_items (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid references public.trade_offers(id) on delete cascade not null,
  user_card_id    uuid references public.user_cards(id) not null,
  quantity        integer not null default 1 check (quantity > 0),
  created_at      timestamptz default now()
);

create index if not exists idx_offer_items_offer on public.trade_offer_items(offer_id);
create index if not exists idx_offer_items_user_card on public.trade_offer_items(user_card_id);

-- 12. Messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade,
  sender_id       uuid references public.users(id) not null,
  recipient_id    uuid references public.users(id) not null,
  subject         text,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz default now(),
  check (sender_id <> recipient_id)
);

create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_messages_trade on public.messages(trade_id);
create index if not exists idx_messages_conversation on public.messages(sender_id, recipient_id, created_at);

-- 13. Notifications
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) not null,
  type            text not null,
  title           text not null,
  body            text,
  data            jsonb default '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(user_id, read_at);

-- 14. Trade Ratings
create table if not exists public.trade_ratings (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade not null,
  rater_id        uuid references public.users(id) not null,
  rated_id        uuid references public.users(id) not null,
  rating          integer not null check (rating >= 1 and rating <= 5),
  comment         text,
  created_at      timestamptz default now(),
  unique(trade_id, rater_id),
  check (rater_id <> rated_id)
);

create index if not exists idx_ratings_rated on public.trade_ratings(rated_id);

-- 15. Blocked Users
create table if not exists public.blocked_users (
  id              uuid primary key default gen_random_uuid(),
  blocker_id      uuid references public.users(id) not null,
  blocked_id      uuid references public.users(id) not null,
  created_at      timestamptz default now(),
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocks_blocker on public.blocked_users(blocker_id);
create index if not exists idx_blocks_blocked on public.blocked_users(blocked_id);

-- 16. User Sessions (anonymous -> registered upgrade tracking)
create table if not exists public.user_sessions (
  id                uuid primary key default gen_random_uuid(),
  fingerprint       text not null unique,
  user_id           uuid references public.users(id),
  device_info       jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  last_seen_at      timestamptz default now()
);

create index if not exists idx_user_sessions_fingerprint on public.user_sessions(fingerprint);
create index if not exists idx_user_sessions_user on public.user_sessions(user_id);

-- =====================
-- HELPER FUNCTIONS
-- =====================

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where clerk_user_id = auth.jwt() ->> 'sub';
$$;

create or replace function public.ensure_user(p_clerk_user_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_clerk_user_id is null or p_clerk_user_id <> coalesce(auth.jwt() ->> 'sub', '') then
    raise exception 'User mismatch';
  end if;

  select id into v_user_id from public.users where clerk_user_id = p_clerk_user_id;

  if v_user_id is not null then
    return v_user_id;
  end if;

  insert into public.users (clerk_user_id, username)
  values (p_clerk_user_id, 'user-' || left(p_clerk_user_id, 8))
  returning id into v_user_id;

  return v_user_id;
end;
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Available quantity on a Have Stack, excluding reservations from the current offer of any pending trade.
-- Optionally exclude a specific trade (e.g. the one being modified) so its own reservations do not count.
create or replace function public.available_quantity(p_user_card_id uuid, p_exclude_trade_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, uc.quantity - coalesce(sum(toi.quantity), 0))::integer
  from public.user_cards uc
  left join public.trade_offer_items toi on toi.user_card_id = uc.id
  left join public.trade_offers to2 on to2.id = toi.offer_id
  left join public.trades t on t.current_offer_id = to2.id and t.status = 'pending'
  where uc.id = p_user_card_id
    and (p_exclude_trade_id is null or t.id is distinct from p_exclude_trade_id)
  group by uc.id, uc.quantity;
$$;

-- =====================
-- WISHLIST RPCs (security definer to support anonymous creators)
-- =====================

create or replace function public.create_wishlist(
  p_id text,
  p_user_id uuid,
  p_game_id uuid,
  p_title text,
  p_owner_name text,
  p_creator_fingerprint text,
  p_visibility text,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  -- Authenticated callers must act as themselves; anonymous callers pass null user_id.
  if p_user_id is not null and p_user_id <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;

  insert into public.wishlists (
    id, user_id, game_id, title, owner_name, creator_fingerprint, visibility
  ) values (
    p_id, p_user_id, p_game_id, p_title, p_owner_name, p_creator_fingerprint, p_visibility
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.wishlist_items (
      wishlist_id,
      card_id,
      card_printing_id,
      quantity,
      condition,
      finish,
      aftermarket_signed,
      is_altered,
      language
    ) values (
      p_id,
      (v_item->>'card_id')::uuid,
      nullif(v_item->>'card_printing_id', '')::uuid,
      coalesce((v_item->>'quantity')::integer, 1),
      nullif(v_item->>'condition', ''),
      nullif(v_item->>'finish', ''),
      case when v_item->>'aftermarket_signed' is null then null else (v_item->>'aftermarket_signed')::boolean end,
      case when v_item->>'is_altered' is null then null else (v_item->>'is_altered')::boolean end,
      nullif(v_item->>'language', '')
    );
  end loop;

  return p_id;
end;
$$;

create or replace function public.delete_wishlist(
  p_wishlist_id text,
  p_user_id uuid,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wishlist record;
begin
  select * into v_wishlist from public.wishlists where id = p_wishlist_id for update;
  if not found then
    return false;
  end if;

  if v_wishlist.user_id is not null then
    if p_user_id is null or p_user_id <> public.current_user_id() or p_user_id <> v_wishlist.user_id then
      raise exception 'Not authorized to delete this wishlist';
    end if;
  else
    if p_fingerprint is null or p_fingerprint <> v_wishlist.creator_fingerprint then
      raise exception 'Not authorized to delete this wishlist';
    end if;
  end if;

  delete from public.wishlists where id = p_wishlist_id;
  return true;
end;
$$;

create or replace function public.upgrade_session(
  p_fingerprint text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;

  update public.user_sessions
  set user_id = p_user_id, last_seen_at = now()
  where fingerprint = p_fingerprint;

  -- Migrate anonymous wishlists created by this fingerprint to the user.
  update public.wishlists
  set user_id = p_user_id, updated_at = now()
  where creator_fingerprint = p_fingerprint and user_id is null;

  return true;
end;
$$;

-- =====================
-- TRADE LIFECYCLE RPCs (security definer for atomic cross-participant updates)
-- =====================

-- Create a new bilateral trade with an initial offer.
create or replace function public.create_trade(
  p_proposer_id uuid,
  p_recipient_id uuid,
  p_offered_items jsonb,   -- [{user_card_id, quantity}]
  p_requested_items jsonb, -- [{user_card_id, quantity}]
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade_id uuid;
  v_offer_id uuid;
  v_item jsonb;
  v_stack_id uuid;
  v_qty integer;
  v_owner_id uuid;
  v_available integer;
begin
  if p_proposer_id <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;
  if p_proposer_id = p_recipient_id then
    raise exception 'Cannot trade with yourself';
  end if;
  if public.is_blocked(p_proposer_id, p_recipient_id) then
    raise exception 'Trade blocked';
  end if;

  -- Validate offered stacks belong to proposer and have availability
  for v_item in select * from jsonb_array_elements(p_offered_items) loop
    v_stack_id := (v_item->>'user_card_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select user_id into v_owner_id
    from public.user_cards
    where id = v_stack_id
    for update;

    if v_owner_id is null then
      raise exception 'Offered stack % not found', v_stack_id;
    end if;
    if v_owner_id <> p_proposer_id then
      raise exception 'Offered stack % does not belong to proposer', v_stack_id;
    end if;

    v_available := public.available_quantity(v_stack_id, null);
    if v_available < v_qty then
      raise exception 'Insufficient quantity in stack % (available %, requested %)',
        v_stack_id, v_available, v_qty;
    end if;
  end loop;

  -- Validate requested stacks belong to recipient and have availability
  for v_item in select * from jsonb_array_elements(p_requested_items) loop
    v_stack_id := (v_item->>'user_card_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select user_id into v_owner_id
    from public.user_cards
    where id = v_stack_id
    for update;

    if v_owner_id is null then
      raise exception 'Requested stack % not found', v_stack_id;
    end if;
    if v_owner_id <> p_recipient_id then
      raise exception 'Requested stack % does not belong to recipient', v_stack_id;
    end if;

    v_available := public.available_quantity(v_stack_id, null);
    if v_available < v_qty then
      raise exception 'Insufficient quantity in requested stack % (available %, requested %)',
        v_stack_id, v_available, v_qty;
    end if;
  end loop;

  insert into public.trades (proposer_id, recipient_id, status, proposer_note)
  values (p_proposer_id, p_recipient_id, 'pending', p_note)
  returning id into v_trade_id;

  insert into public.trade_offers (trade_id, offered_by, note)
  values (v_trade_id, p_proposer_id, p_note)
  returning id into v_offer_id;

  insert into public.trade_offer_items (offer_id, user_card_id, quantity)
  select v_offer_id, (value->>'user_card_id')::uuid, (value->>'quantity')::integer
  from jsonb_array_elements(p_offered_items);

  insert into public.trade_offer_items (offer_id, user_card_id, quantity)
  select v_offer_id, (value->>'user_card_id')::uuid, (value->>'quantity')::integer
  from jsonb_array_elements(p_requested_items);

  update public.trades set current_offer_id = v_offer_id where id = v_trade_id;

  return v_trade_id;
end;
$$;

-- Create a counter-offer (or any follow-up offer) on a pending trade.
create or replace function public.create_counter_offer(
  p_trade_id uuid,
  p_offered_by uuid,
  p_offered_items jsonb,
  p_requested_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade record;
  v_other_party_id uuid;
  v_current_offer record;
  v_offer_id uuid;
  v_item jsonb;
  v_stack_id uuid;
  v_qty integer;
  v_owner_id uuid;
  v_available integer;
begin
  if p_offered_by <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Trade not found';
  end if;
  if v_trade.status <> 'pending' then
    raise exception 'Trade is not pending';
  end if;
  if p_offered_by <> v_trade.proposer_id and p_offered_by <> v_trade.recipient_id then
    raise exception 'User is not a participant';
  end if;

  v_other_party_id := case when p_offered_by = v_trade.proposer_id
                           then v_trade.recipient_id
                           else v_trade.proposer_id end;

  if public.is_blocked(p_offered_by, v_other_party_id) then
    raise exception 'Trade blocked';
  end if;

  -- Alternation rule: only the participant who did NOT create the current offer may create a new one.
  select * into v_current_offer
  from public.trade_offers
  where id = v_trade.current_offer_id;

  if v_current_offer is not null and v_current_offer.offered_by = p_offered_by then
    raise exception 'Must wait for the other party to respond before offering again';
  end if;

  -- Validate offered stacks belong to offerer
  for v_item in select * from jsonb_array_elements(p_offered_items) loop
    v_stack_id := (v_item->>'user_card_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select user_id into v_owner_id
    from public.user_cards
    where id = v_stack_id
    for update;

    if v_owner_id is null then
      raise exception 'Offered stack % not found', v_stack_id;
    end if;
    if v_owner_id <> p_offered_by then
      raise exception 'Offered stack % does not belong to offerer', v_stack_id;
    end if;

    v_available := public.available_quantity(v_stack_id, p_trade_id);
    if v_available < v_qty then
      raise exception 'Insufficient quantity in stack % (available %, requested %)',
        v_stack_id, v_available, v_qty;
    end if;
  end loop;

  -- Validate requested stacks belong to other party
  for v_item in select * from jsonb_array_elements(p_requested_items) loop
    v_stack_id := (v_item->>'user_card_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select user_id into v_owner_id
    from public.user_cards
    where id = v_stack_id
    for update;

    if v_owner_id is null then
      raise exception 'Requested stack % not found', v_stack_id;
    end if;
    if v_owner_id <> v_other_party_id then
      raise exception 'Requested stack % does not belong to other party', v_stack_id;
    end if;

    v_available := public.available_quantity(v_stack_id, p_trade_id);
    if v_available < v_qty then
      raise exception 'Insufficient quantity in requested stack % (available %, requested %)',
        v_stack_id, v_available, v_qty;
    end if;
  end loop;

  insert into public.trade_offers (trade_id, offered_by, note)
  values (p_trade_id, p_offered_by, p_note)
  returning id into v_offer_id;

  insert into public.trade_offer_items (offer_id, user_card_id, quantity)
  select v_offer_id, (value->>'user_card_id')::uuid, (value->>'quantity')::integer
  from jsonb_array_elements(p_offered_items);

  insert into public.trade_offer_items (offer_id, user_card_id, quantity)
  select v_offer_id, (value->>'user_card_id')::uuid, (value->>'quantity')::integer
  from jsonb_array_elements(p_requested_items);

  update public.trades set current_offer_id = v_offer_id, updated_at = now() where id = p_trade_id;

  return v_offer_id;
end;
$$;

-- Respond to the current offer: accept or reject. Only the non-offerer may respond.
create or replace function public.respond_to_offer(
  p_trade_id uuid,
  p_user_id uuid,
  p_action text  -- 'accept' or 'reject'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade record;
  v_offer record;
  v_item record;
  v_stack record;
  v_available integer;
begin
  if p_user_id <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;
  if p_action not in ('accept', 'reject') then
    raise exception 'Invalid action %', p_action;
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Trade not found';
  end if;
  if v_trade.status <> 'pending' then
    raise exception 'Trade is not pending';
  end if;
  if p_user_id <> v_trade.proposer_id and p_user_id <> v_trade.recipient_id then
    raise exception 'User is not a participant';
  end if;

  select * into v_offer from public.trade_offers where id = v_trade.current_offer_id;
  if v_offer is null then
    raise exception 'No current offer';
  end if;
  if v_offer.offered_by = p_user_id then
    raise exception 'Offerer cannot respond to their own offer';
  end if;

  if p_action = 'reject' then
    update public.trades
    set status = 'rejected', updated_at = now(), completed_at = now()
    where id = p_trade_id;
    return;
  end if;

  -- Accept: decrement every referenced stack. Lock trade + stacks for the duration.
  for v_item in
    select toi.user_card_id, toi.quantity
    from public.trade_offer_items toi
    where toi.offer_id = v_offer.id
  loop
    select * into v_stack from public.user_cards where id = v_item.user_card_id for update;
    if not found then
      raise exception 'Stack % no longer exists', v_item.user_card_id;
    end if;

    v_available := public.available_quantity(v_item.user_card_id, p_trade_id);
    if v_available < v_item.quantity then
      raise exception 'Stack % no longer has sufficient quantity', v_item.user_card_id;
    end if;

    if v_stack.quantity = v_item.quantity then
      delete from public.user_cards where id = v_stack.id;
    else
      update public.user_cards
      set quantity = quantity - v_item.quantity, updated_at = now()
      where id = v_stack.id;
    end if;
  end loop;

  update public.trades
  set status = 'accepted', updated_at = now(), completed_at = now()
  where id = p_trade_id;
end;
$$;

-- Cancel a pending trade at any time by either participant.
create or replace function public.cancel_trade(
  p_trade_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade record;
begin
  if p_user_id <> public.current_user_id() then
    raise exception 'User mismatch';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Trade not found';
  end if;
  if v_trade.status <> 'pending' then
    raise exception 'Trade is not pending';
  end if;
  if p_user_id <> v_trade.proposer_id and p_user_id <> v_trade.recipient_id then
    raise exception 'User is not a participant';
  end if;

  update public.trades
  set status = 'cancelled', updated_at = now(), completed_at = now()
  where id = p_trade_id;
end;
$$;

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.cards enable row level security;
alter table public.card_printings enable row level security;
alter table public.card_external_refs enable row level security;
alter table public.printing_external_refs enable row level security;
alter table public.user_cards enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.trades enable row level security;
alter table public.trade_offers enable row level security;
alter table public.trade_offer_items enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.trade_ratings enable row level security;
alter table public.blocked_users enable row level security;
alter table public.user_sessions enable row level security;

-- Users: public read; own update; creation via ensure_user RPC
 create policy "Users are publicly readable"
   on public.users for select
   using (true);

 create policy "Users insert restricted to ensure_user RPC"
   on public.users for insert
   with check (false);

 create policy "Users can update own profile"
   on public.users for update
   using (current_user_id() = id);

-- Games: public read
 create policy "Games are publicly readable"
   on public.games for select
   using (true);

-- Cards & Printings: public read
 create policy "Cards are publicly readable"
   on public.cards for select
   using (true);

 create policy "Card printings are publicly readable"
   on public.card_printings for select
   using (true);

 create policy "Card external refs are publicly readable"
   on public.card_external_refs for select
   using (true);

 create policy "Printing external refs are publicly readable"
   on public.printing_external_refs for select
   using (true);

-- User Cards: owner full control
 create policy "User cards visible to owner"
   on public.user_cards for select
   using (user_id = current_user_id());

 create policy "User cards insert by owner"
   on public.user_cards for insert
   with check (user_id = current_user_id());

 create policy "User cards update by owner"
   on public.user_cards for update
   using (user_id = current_user_id());

 create policy "User cards delete by owner"
   on public.user_cards for delete
   using (user_id = current_user_id());

-- Wishlists: public read public lists; owner manage
 create policy "Wishlists are publicly readable"
   on public.wishlists for select
   using (visibility = 'public' or user_id = current_user_id());

-- Mutations go through RPCs so that anonymous creators can manage their own lists.
 create policy "Wishlists insert restricted to RPC"
   on public.wishlists for insert
   with check (false);

 create policy "Wishlists update restricted to RPC"
   on public.wishlists for update
   using (false);

 create policy "Wishlists delete restricted to RPC"
   on public.wishlists for delete
   using (false);

-- Wishlist Items: public read; owner manage via RPC
 create policy "Wishlist items are publicly readable"
   on public.wishlist_items for select
   using (
     exists (
       select 1 from public.wishlists
       where id = wishlist_id and (visibility = 'public' or user_id = current_user_id())
     )
   );

 create policy "Wishlist items insert restricted to RPC"
   on public.wishlist_items for insert
   with check (false);

 create policy "Wishlist items delete restricted to RPC"
   on public.wishlist_items for delete
   using (false);

-- Trades: participants only
 create policy "Trades visible to participants"
   on public.trades for select
   using (proposer_id = current_user_id() or recipient_id = current_user_id());

-- Trade mutations go through RPCs (security definer), so RLS write policies are restrictive fallbacks.
 create policy "Trades insert restricted to RPC"
   on public.trades for insert
   with check (false);

 create policy "Trades update restricted to RPC"
   on public.trades for update
   using (false);

-- Trade Offers: participants only
 create policy "Trade offers visible to participants"
   on public.trade_offers for select
   using (
     exists (
       select 1 from public.trades
       where id = trade_id
       and (proposer_id = current_user_id() or recipient_id = current_user_id())
     )
   );

 create policy "Trade offers insert restricted to RPC"
   on public.trade_offers for insert
   with check (false);

-- Trade Offer Items: participants only
 create policy "Trade offer items visible to participants"
   on public.trade_offer_items for select
   using (
     exists (
       select 1 from public.trade_offers o
       join public.trades t on t.id = o.trade_id
       where o.id = offer_id
       and (t.proposer_id = current_user_id() or t.recipient_id = current_user_id())
     )
   );

 create policy "Trade offer items insert restricted to RPC"
   on public.trade_offer_items for insert
   with check (false);

-- Messages: participants only
 create policy "Messages visible to participants"
   on public.messages for select
   using (sender_id = current_user_id() or recipient_id = current_user_id());

 create policy "Messages can be sent by authenticated users"
   on public.messages for insert
   with check (sender_id = current_user_id());

 create policy "Messages can be marked read by recipient"
   on public.messages for update
   using (recipient_id = current_user_id());

-- Notifications: only the recipient
 create policy "Notifications visible to recipient"
   on public.notifications for select
   using (user_id = current_user_id());

 create policy "Notifications update by recipient"
   on public.notifications for update
   using (user_id = current_user_id());

-- Trade Ratings: public read; participants insert via RPC
 create policy "Trade ratings are publicly readable"
   on public.trade_ratings for select
   using (true);

 create policy "Trade ratings insert restricted to RPC"
   on public.trade_ratings for insert
   with check (false);

-- Blocked Users: blocker manages their blocks
 create policy "Users can see their blocks"
   on public.blocked_users for select
   using (blocker_id = current_user_id());

 create policy "Users can block others"
   on public.blocked_users for insert
   with check (blocker_id = current_user_id());

 create policy "Users can unblock"
   on public.blocked_users for delete
   using (blocker_id = current_user_id());

-- User Sessions: read/update by linked user only; insert by anyone
 create policy "User sessions visible by owner"
   on public.user_sessions for select
   using (user_id = current_user_id());

 create policy "User sessions insert by anonymous"
   on public.user_sessions for insert
   with check (true);

 create policy "User sessions update by owner via RPC"
   on public.user_sessions for update
   using (false);
-- Admin and ratings RPCs (security definer so normal RLS policies stay intact)

create or replace function public.admin_dashboard_stats()
returns table (
  total_users bigint,
  total_trades bigint,
  total_collection_cards bigint,
  recent_users jsonb,
  recent_trades jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (select count(*) from public.users),
    (select count(*) from public.trades),
    (select coalesce(sum(quantity), 0) from public.user_cards),
    (select coalesce(jsonb_agg(u), '[]'::jsonb)
       from (
         select id, username, is_admin, created_at
         from public.users
         order by created_at desc
         limit 100
       ) u
    ),
    (select coalesce(jsonb_agg(t), '[]'::jsonb)
       from (
         select id, proposer_id, recipient_id, status, created_at
         from public.trades
         order by created_at desc
         limit 100
       ) t
    );
end;
$$;

create or replace function public.admin_list_users(
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (select jsonb_agg(u)
       from (
         select id, username, is_admin, created_at
         from public.users
         order by created_at desc
         limit p_limit offset p_offset
       ) u
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_list_trades(
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (select jsonb_agg(t)
       from (
         select id, proposer_id, recipient_id, status, created_at
         from public.trades
         order by created_at desc
         limit p_limit offset p_offset
       ) t
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.create_trade_rating(
  p_trade_id uuid,
  p_rated_id uuid,
  p_rating integer,
  p_comment text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rater_id uuid;
  v_trade record;
begin
  v_rater_id := public.current_user_id();
  if v_rater_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_trade from public.trades where id = p_trade_id;
  if not found then
    raise exception 'Trade not found';
  end if;
  if v_trade.status <> 'accepted' then
    raise exception 'Can only rate completed trades';
  end if;
  if v_trade.proposer_id <> v_rater_id and v_trade.recipient_id <> v_rater_id then
    raise exception 'Only trade participants can rate';
  end if;
  if (v_trade.proposer_id = v_rater_id and v_trade.recipient_id <> p_rated_id)
     or (v_trade.recipient_id = v_rater_id and v_trade.proposer_id <> p_rated_id) then
    raise exception 'Rated user must be the other trade participant';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  insert into public.trade_ratings (trade_id, rater_id, rated_id, rating, comment)
  values (p_trade_id, v_rater_id, p_rated_id, p_rating, p_comment)
  on conflict (trade_id, rater_id)
  do update set rating = excluded.rating,
                comment = excluded.comment,
                updated_at = now();

  return true;
end;
$$;
-- Trade negotiation helpers: expose offer details and counterparty stacks to participants
-- via security-definer RPCs so that RLS on user_cards can stay owner-only.

create or replace function public.get_trade_details(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_trade record;
  v_offer record;
  v_items jsonb;
begin
  select t.*, pu.username as proposer_username, ru.username as recipient_username
  into v_trade
  from public.trades t
  join public.users pu on pu.id = t.proposer_id
  join public.users ru on ru.id = t.recipient_id
  where t.id = p_trade_id;

  if v_trade is null then
    raise exception 'Trade not found';
  end if;

  if v_trade.proposer_id <> v_user_id and v_trade.recipient_id <> v_user_id then
    raise exception 'Not a participant';
  end if;

  select *
  into v_offer
  from public.trade_offers
  where id = v_trade.current_offer_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_card_id', toi.user_card_id,
      'quantity', toi.quantity,
      'side', toi.side,
      'owner_id', uc.user_id,
      'card_name', c.name,
      'set_code', cp.set_code,
      'collector_number', cp.collector_number,
      'finish', cp.finish,
      'condition', uc.condition,
      'aftermarket_signed', uc.aftermarket_signed,
      'is_altered', uc.is_altered,
      'language', cp.language,
      'image_url', coalesce(cp.image_url, c.image_url)
    )
  ), '[]'::jsonb)
  into v_items
  from public.trade_offer_items toi
  join public.user_cards uc on uc.id = toi.user_card_id
  join public.card_printings cp on cp.id = uc.card_printing_id
  join public.cards c on c.id = cp.card_id
  where toi.offer_id = v_trade.current_offer_id;

  return jsonb_build_object(
    'id', v_trade.id,
    'status', v_trade.status,
    'proposer_id', v_trade.proposer_id,
    'recipient_id', v_trade.recipient_id,
    'proposer_username', v_trade.proposer_username,
    'recipient_username', v_trade.recipient_username,
    'current_offer_id', v_trade.current_offer_id,
    'offer_note', coalesce(v_offer.note, v_trade.proposer_note),
    'offer_created_at', v_offer.created_at,
    'items', v_items
  );
end;
$$;

create or replace function public.get_counterparty_stacks(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_trade record;
  v_other_id uuid;
  v_stacks jsonb;
begin
  select * into v_trade from public.trades where id = p_trade_id;

  if v_trade is null then
    raise exception 'Trade not found';
  end if;

  if v_trade.proposer_id <> v_user_id and v_trade.recipient_id <> v_user_id then
    raise exception 'Not a participant';
  end if;

  v_other_id := case when v_trade.proposer_id = v_user_id then v_trade.recipient_id else v_trade.proposer_id end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_card_id', uc.id,
      'quantity', uc.quantity,
      'available_quantity', public.available_quantity(uc.id, null),
      'condition', uc.condition,
      'aftermarket_signed', uc.aftermarket_signed,
      'is_altered', uc.is_altered,
      'is_tradeable', uc.is_tradeable,
      'card_name', c.name,
      'set_code', cp.set_code,
      'collector_number', cp.collector_number,
      'finish', cp.finish,
      'language', cp.language,
      'image_url', coalesce(cp.image_url, c.image_url)
    )
  ), '[]'::jsonb)
  into v_stacks
  from public.user_cards uc
  join public.card_printings cp on cp.id = uc.card_printing_id
  join public.cards c on c.id = cp.card_id
  where uc.user_id = v_other_id
    and uc.is_tradeable = true;

  return v_stacks;
end;
$$;

grant execute on function public.get_trade_details(uuid) to authenticated, anon;
grant execute on function public.get_counterparty_stacks(uuid) to authenticated, anon;
-- Include the current offer creator in get_trade_details so clients know whose turn it is.

create or replace function public.get_trade_details(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_trade record;
  v_offer record;
  v_items jsonb;
begin
  select t.*, pu.username as proposer_username, ru.username as recipient_username
  into v_trade
  from public.trades t
  join public.users pu on pu.id = t.proposer_id
  join public.users ru on ru.id = t.recipient_id
  where t.id = p_trade_id;

  if v_trade is null then
    raise exception 'Trade not found';
  end if;

  if v_trade.proposer_id <> v_user_id and v_trade.recipient_id <> v_user_id then
    raise exception 'Not a participant';
  end if;

  select *
  into v_offer
  from public.trade_offers
  where id = v_trade.current_offer_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_card_id', toi.user_card_id,
      'quantity', toi.quantity,
      'side', toi.side,
      'owner_id', uc.user_id,
      'card_name', c.name,
      'set_code', cp.set_code,
      'collector_number', cp.collector_number,
      'finish', cp.finish,
      'condition', uc.condition,
      'aftermarket_signed', uc.aftermarket_signed,
      'is_altered', uc.is_altered,
      'language', cp.language,
      'image_url', coalesce(cp.image_url, c.image_url)
    )
  ), '[]'::jsonb)
  into v_items
  from public.trade_offer_items toi
  join public.user_cards uc on uc.id = toi.user_card_id
  join public.card_printings cp on cp.id = uc.card_printing_id
  join public.cards c on c.id = cp.card_id
  where toi.offer_id = v_trade.current_offer_id;

  return jsonb_build_object(
    'id', v_trade.id,
    'status', v_trade.status,
    'proposer_id', v_trade.proposer_id,
    'recipient_id', v_trade.recipient_id,
    'proposer_username', v_trade.proposer_username,
    'recipient_username', v_trade.recipient_username,
    'current_offer_id', v_trade.current_offer_id,
    'current_offer_offered_by', v_offer.offered_by,
    'offer_note', coalesce(v_offer.note, v_trade.proposer_note),
    'offer_created_at', v_offer.created_at,
    'items', v_items
  );
end;
$$;

grant execute on function public.get_trade_details(uuid) to authenticated, anon;
-- Create notifications for trade and message events so users see updates in real time.

create or replace function public.notify_on_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_id uuid;
  v_status text;
begin
  select status into v_status from public.trades where id = NEW.trade_id;
  if v_status <> 'pending' then
    return NEW;
  end if;

  select case when t.proposer_id = NEW.offered_by then t.recipient_id else t.proposer_id end
  into v_other_id
  from public.trades t
  where t.id = NEW.trade_id;

  insert into public.notifications (user_id, type, data)
  values (v_other_id, 'trade_offer', jsonb_build_object('trade_id', NEW.trade_id, 'offer_id', NEW.id));

  return NEW;
end;
$$;

create trigger trg_trade_offer_notify
  after insert on public.trade_offers
  for each row
  execute function public.notify_on_offer();

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, data)
  values (NEW.recipient_id, 'message', jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id, 'trade_id', NEW.trade_id));
  return NEW;
end;
$$;

create trigger trg_message_notify
  after insert on public.messages
  for each row
  execute function public.notify_on_message();

create or replace function public.notify_on_trade_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_id uuid;
  v_type text;
begin
  if OLD.status = NEW.status then
    return NEW;
  end if;

  if NEW.status not in ('accepted', 'rejected', 'cancelled') then
    return NEW;
  end if;

  v_type := 'trade_' || NEW.status;
  v_other_id := case when public.current_user_id() = NEW.proposer_id then NEW.recipient_id else NEW.proposer_id end;

  insert into public.notifications (user_id, type, data)
  values (v_other_id, v_type, jsonb_build_object('trade_id', NEW.id, 'status', NEW.status));

  return NEW;
end;
$$;

create trigger trg_trade_status_notify
  after update of status on public.trades
  for each row
  execute function public.notify_on_trade_status();

-- Enable realtime for notifications.
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
-- Public profile data: expose a user's public wishlists and tradeable collection stacks
-- through a security-definer RPC so RLS on user_cards stays owner-only.

create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_wishlists jsonb;
  v_stacks jsonb;
  v_ratings jsonb;
  v_avg numeric;
  v_count integer;
begin
  select id, username, created_at into v_user
  from public.users
  where id = p_user_id;

  if v_user is null then
    raise exception 'User not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', w.id,
      'title', w.title,
      'game_slug', g.slug,
      'created_at', w.created_at
    )
  ), '[]'::jsonb)
  into v_wishlists
  from public.wishlists w
  left join public.games g on g.id = w.game_id
  where w.user_id = p_user_id and w.visibility = 'public';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_card_id', uc.id,
      'quantity', uc.quantity,
      'condition', uc.condition,
      'finish', cp.finish,
      'language', cp.language,
      'card_name', c.name,
      'set_code', cp.set_code,
      'collector_number', cp.collector_number,
      'image_url', coalesce(cp.image_url, c.image_url)
    )
  ), '[]'::jsonb)
  into v_stacks
  from public.user_cards uc
  join public.card_printings cp on cp.id = uc.card_printing_id
  join public.cards c on c.id = cp.card_id
  where uc.user_id = p_user_id and uc.is_tradeable = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tr.id,
      'rating', tr.rating,
      'comment', tr.comment,
      'created_at', tr.created_at,
      'rater_username', ru.username
    ) order by tr.created_at desc
  ), '[]'::jsonb)
  into v_ratings
  from public.trade_ratings tr
  join public.users ru on ru.id = tr.rater_id
  where tr.rated_id = p_user_id;

  select avg(rating), count(*)
  into v_avg, v_count
  from public.trade_ratings
  where rated_id = p_user_id;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'created_at', v_user.created_at,
    'wishlists', v_wishlists,
    'stacks', v_stacks,
    'ratings', v_ratings,
    'average_rating', case when v_count > 0 then round(v_avg::numeric, 2) else null end,
    'total_ratings', v_count
  );
end;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated, anon;
-- trade_offer_items does not have a side column; remove it from get_trade_details.

create or replace function public.get_trade_details(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_trade record;
  v_offer record;
  v_items jsonb;
begin
  select t.*, pu.username as proposer_username, ru.username as recipient_username
  into v_trade
  from public.trades t
  join public.users pu on pu.id = t.proposer_id
  join public.users ru on ru.id = t.recipient_id
  where t.id = p_trade_id;

  if v_trade is null then
    raise exception 'Trade not found';
  end if;

  if v_trade.proposer_id <> v_user_id and v_trade.recipient_id <> v_user_id then
    raise exception 'Not a participant';
  end if;

  select *
  into v_offer
  from public.trade_offers
  where id = v_trade.current_offer_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_card_id', toi.user_card_id,
      'quantity', toi.quantity,
      'owner_id', uc.user_id,
      'card_name', c.name,
      'set_code', cp.set_code,
      'collector_number', cp.collector_number,
      'finish', cp.finish,
      'condition', uc.condition,
      'aftermarket_signed', uc.aftermarket_signed,
      'is_altered', uc.is_altered,
      'language', cp.language,
      'image_url', coalesce(cp.image_url, c.image_url)
    )
  ), '[]'::jsonb)
  into v_items
  from public.trade_offer_items toi
  join public.user_cards uc on uc.id = toi.user_card_id
  join public.card_printings cp on cp.id = uc.card_printing_id
  join public.cards c on c.id = cp.card_id
  where toi.offer_id = v_trade.current_offer_id;

  return jsonb_build_object(
    'id', v_trade.id,
    'status', v_trade.status,
    'proposer_id', v_trade.proposer_id,
    'recipient_id', v_trade.recipient_id,
    'proposer_username', v_trade.proposer_username,
    'recipient_username', v_trade.recipient_username,
    'current_offer_id', v_trade.current_offer_id,
    'current_offer_offered_by', v_offer.offered_by,
    'offer_note', coalesce(v_offer.note, v_trade.proposer_note),
    'offer_created_at', v_offer.created_at,
    'items', v_items
  );
end;
$$;

grant execute on function public.get_trade_details(uuid) to authenticated, anon;
