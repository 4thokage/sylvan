-- Add game_id column to user_cards for multi-game support
alter table if exists public.user_cards add column if not exists game_id uuid references public.games(id);

create index if not exists idx_user_cards_game on public.user_cards(game_id);
