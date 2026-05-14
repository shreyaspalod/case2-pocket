-- ============================================================
-- Pocket — Reset Script
-- Run this FIRST to wipe any partial state, then run schema.sql
-- ============================================================

-- Drop view
drop view if exists public.activity_feed cascade;

-- Drop tables in reverse dependency order
drop table if exists public.settlements    cascade;
drop table if exists public.expense_splits cascade;
drop table if exists public.expenses       cascade;
drop table if exists public.group_members  cascade;
drop table if exists public.groups         cascade;
drop table if exists public.profiles       cascade;

-- Drop trigger and function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
