-- Sylvan Web: Initial Schema
-- Clean single migration for pre-production reset.

-- 0. Extensions
create extension if not exists extensions.pg_trgm;

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
  clerk_user_id     text unique,
  username          text unique,
  display_name      text,
  avatar_url        text,
  bio               text,
  location          text,
  shipping_prefs    jsonb default '{}'::jsonb,
  is_public         boolean default false,
  is_admin          boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 3. Cards (abstract identity layer)
create table if not exists public.cards (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid references public.games(id) not null,
  oracle_id       text,
  name            text not null,
  normalized_name text not null,
  image_url       text,
  game_data       jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);

create index if not exists idx_cards_game on public.cards(game_id);
create index if not exists idx_cards_oracle on public.cards(oracle_id);
create index if not exists idx_cards_name_trgm on public.cards using gin(normalized_name gin_trgm_ops);

-- 4. Card Printings (physical version layer)
create table if not exists public.card_printings (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid references public.cards(id) not null,
  game_id           uuid references public.games(id) not null,
  set_code          text not null,
  set_name          text not null,
  collector_number  text,
  rarity            text,
  language          text default 'en',
  image_url         text,
  is_foil           boolean default false,
  is_full_art       boolean default false,
  market_price_usd  decimal(12,2),
  market_price_eur  decimal(12,2),
  last_price_update timestamptz,
  created_at        timestamptz default now()
);

create index if not exists idx_printings_card on public.card_printings(card_id);
create index if not exists idx_printings_set on public.card_printings(set_code);
create index if not exists idx_printings_game on public.card_printings(game_id);

-- 5. User Cards (user-owned instance stacks)
create table if not exists public.user_cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id) not null,
  card_printing_id  uuid references public.card_printings(id) not null,
  game_id           uuid references public.games(id) not null,
  quantity          integer default 1,
  condition         text default 'NM',
  is_foil           boolean default false,
  is_signed         boolean default false,
  is_altered        boolean default false,
  language          text default 'en',
  is_tradeable      boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_user_cards_user on public.user_cards(user_id);
create index if not exists idx_user_cards_printing on public.user_cards(card_printing_id);
create index if not exists idx_user_cards_game on public.user_cards(game_id);

-- 6. Wishlists
create table if not exists public.wishlists (
  id                  text primary key,
  user_id             uuid references public.users(id),
  game_id             uuid references public.games(id),
  title               text,
  owner_name          text,
  creator_fingerprint text,
  visibility          text default 'public',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_wishlists_user on public.wishlists(user_id);
create index if not exists idx_wishlists_visibility on public.wishlists(visibility);

-- 7. Wishlist Items (card identity level + optional printing preference)
create table if not exists public.wishlist_items (
  id                uuid primary key default gen_random_uuid(),
  wishlist_id       text references public.wishlists(id) on delete cascade not null,
  card_id           uuid references public.cards(id) not null,
  card_printing_id  uuid references public.card_printings(id),
  quantity          integer default 1,
  condition         text default 'NM',
  is_foil           boolean default false,
  is_signed         boolean default false,
  is_altered        boolean default false,
  language          text default 'en',
  created_at        timestamptz default now()
);

create index if not exists idx_wishlist_items_wishlist on public.wishlist_items(wishlist_id);
create index if not exists idx_wishlist_items_card on public.wishlist_items(card_id);
create index if not exists idx_wishlist_items_printing on public.wishlist_items(card_printing_id);

-- 8. Trades
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  proposer_id     uuid references public.users(id) not null,
  recipient_id    uuid references public.users(id) not null,
  status          text default 'pending',
  proposer_note   text,
  recipient_note  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  completed_at    timestamptz
);

create index if not exists idx_trades_proposer on public.trades(proposer_id);
create index if not exists idx_trades_recipient on public.trades(recipient_id);
create index if not exists idx_trades_status on public.trades(status);

-- 9. Trade Offers (immutable snapshots)
create table if not exists public.trade_offers (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade not null,
  offered_by      uuid references public.users(id) not null,
  created_at      timestamptz default now()
);

create index if not exists idx_trade_offers_trade on public.trade_offers(trade_id);

-- Add current_offer_id to trades (circular FK, must come after trade_offers)
alter table public.trades
  add column if not exists current_offer_id uuid references public.trade_offers(id);

create index if not exists idx_trades_current_offer on public.trades(current_offer_id);

-- 10. Trade Offer Items (items within an immutable offer)
create table if not exists public.trade_offer_items (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid references public.trade_offers(id) on delete cascade not null,
  user_card_id    uuid references public.user_cards(id) not null,
  side            text not null,
  created_at      timestamptz default now()
);

create index if not exists idx_offer_items_offer on public.trade_offer_items(offer_id);

-- 11. Messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade,
  sender_id       uuid references public.users(id) not null,
  recipient_id    uuid references public.users(id) not null,
  subject         text,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_messages_trade on public.messages(trade_id);

-- 12. Notifications
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

-- 13. Trade Ratings
create table if not exists public.trade_ratings (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid references public.trades(id) on delete cascade not null,
  rater_id        uuid references public.users(id) not null,
  rated_id        uuid references public.users(id) not null,
  rating          integer not null check (rating >= 1 and rating <= 5),
  comment         text,
  created_at      timestamptz default now(),
  unique(trade_id, rater_id)
);

-- 14. Blocked Users
create table if not exists public.blocked_users (
  id              uuid primary key default gen_random_uuid(),
  blocker_id      uuid references public.users(id) not null,
  blocked_id      uuid references public.users(id) not null,
  created_at      timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- 15. User Sessions (anonymous -> registered upgrade tracking)
create table if not exists public.user_sessions (
  id                uuid primary key default gen_random_uuid(),
  fingerprint       text not null,
  user_id           uuid references public.users(id),
  device_info       jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  last_seen_at      timestamptz default now()
);

create index if not exists idx_user_sessions_fingerprint on public.user_sessions(fingerprint);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.users enable row level security;
alter table public.cards enable row level security;
alter table public.card_printings enable row level security;
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

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where clerk_user_id = auth.jwt() ->> 'sub';
$$;

-- Users: can read public profiles; can write own profile
create policy "Users are publicly viewable if is_public"
  on public.users for select
  using (is_public = true or current_user_id() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (current_user_id() = id);

create policy "Users can update own profile"
  on public.users for update
  using (current_user_id() = id);

-- Cards: public read
create policy "Cards are publicly readable"
  on public.cards for select
  using (true);

-- Card Printings: public read
create policy "Card printings are publicly readable"
  on public.card_printings for select
  using (true);

-- User Cards: owner can CRUD; public can read if user's profile is public
create policy "User cards visible to owner"
  on public.user_cards for select
  using (
    user_id = current_user_id()
    or exists (
      select 1 from public.users
      where id = user_id and is_public = true
    )
  );

create policy "User cards insert by owner"
  on public.user_cards for insert
  with check (user_id = current_user_id());

create policy "User cards update by owner"
  on public.user_cards for update
  using (user_id = current_user_id());

create policy "User cards delete by owner"
  on public.user_cards for delete
  using (user_id = current_user_id());

-- Wishlists: public read; owner/creator can manage
create policy "Wishlists are publicly readable"
  on public.wishlists for select
  using (visibility = 'public' or user_id = current_user_id());

create policy "Wishlists insert by owner"
  on public.wishlists for insert
  with check (user_id = current_user_id());

create policy "Wishlists update by owner"
  on public.wishlists for update
  using (user_id = current_user_id());

create policy "Wishlists delete by owner"
  on public.wishlists for delete
  using (user_id = current_user_id());

-- Wishlist Items: public read; owner can manage
create policy "Wishlist items are publicly readable"
  on public.wishlist_items for select
  using (true);

create policy "Wishlist items insert by owner"
  on public.wishlist_items for insert
  with check (
    exists (
      select 1 from public.wishlists
      where id = wishlist_id and user_id = current_user_id()
    )
  );

create policy "Wishlist items delete by owner"
  on public.wishlist_items for delete
  using (
    exists (
      select 1 from public.wishlists
      where id = wishlist_id and user_id = current_user_id()
    )
  );

-- Trades: participants can see and update their trades
create policy "Trades visible to participants"
  on public.trades for select
  using (proposer_id = current_user_id() or recipient_id = current_user_id());

create policy "Trades can be created by authenticated users"
  on public.trades for insert
  with check (proposer_id = current_user_id());

create policy "Trades can be updated by participants"
  on public.trades for update
  using (proposer_id = current_user_id() or recipient_id = current_user_id());

-- Trade Offers: visible to trade participants
create policy "Trade offers visible to participants"
  on public.trade_offers for select
  using (
    exists (
      select 1 from public.trades
      where id = trade_id
      and (proposer_id = current_user_id() or recipient_id = current_user_id())
    )
  );

create policy "Trade offers insert by proposer"
  on public.trade_offers for insert
  with check (
    exists (
      select 1 from public.trades
      where id = trade_id and proposer_id = current_user_id()
    )
  );

-- Trade Offer Items: visible to trade participants
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

create policy "Trade offer items insert by offer owner"
  on public.trade_offer_items for insert
  with check (
    exists (
      select 1 from public.trade_offers o
      join public.trades t on t.id = o.trade_id
      where o.id = offer_id and t.proposer_id = current_user_id()
    )
  );

-- Messages: visible to sender or recipient
create policy "Messages visible to participants"
  on public.messages for select
  using (sender_id = current_user_id() or recipient_id = current_user_id());

create policy "Messages can be sent by authenticated users"
  on public.messages for insert
  with check (sender_id = current_user_id());

create policy "Messages can be marked read by recipient"
  on public.messages for update
  using (recipient_id = current_user_id());

-- Notifications: only the recipient can see own notifications
create policy "Notifications visible to recipient"
  on public.notifications for select
  using (user_id = current_user_id());

create policy "Notifications update by recipient"
  on public.notifications for update
  using (user_id = current_user_id());

-- Trade Ratings: publicly readable; participants can rate
create policy "Trade ratings are publicly readable"
  on public.trade_ratings for select
  using (true);

create policy "Trade ratings insert by participants"
  on public.trade_ratings for insert
  with check (rater_id = current_user_id());

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

-- User Sessions: public read/insert by fingerprint for anonymous flow
create policy "User sessions visible by fingerprint"
  on public.user_sessions for select
  using (true);

create policy "User sessions insert"
  on public.user_sessions for insert
  with check (true);

create policy "User sessions update"
  on public.user_sessions for update
  using (true);
