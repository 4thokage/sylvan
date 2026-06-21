-- Fix current_user_id() to use security definer to prevent RLS recursion.
-- When called from RLS policies (which every policy uses), the function queries
-- public.users internally. Without security definer, PostgreSQL re-checks RLS
-- on the inner query, and the policy on users also calls current_user_id(),
-- causing infinite recursion on certain query paths (INSERT/UPDATE with subqueries).
-- Run this in your Supabase SQL editor.

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where clerk_user_id = auth.jwt() ->> 'sub';
$$;
