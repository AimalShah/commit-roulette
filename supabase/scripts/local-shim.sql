-- =============================================================================
-- Local Supabase shim — NOT part of the migration history.
--
-- Supabase provisions these itself. This file exists so the migrations can be
-- applied and tested against a plain Postgres 16, which is the only way to know
-- the SQL is correct before it reaches a real project. Apply it once, before
-- the migrations, when testing locally:
--
--   psql -f supabase/scripts/local-shim.sql -d postgres
-- =============================================================================

create schema if not exists auth;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase's request-scoped identity. The Edge Runtime sets these from the
-- verified JWT; here a session GUC stands in for that.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon')
$$;

-- service_role bypasses RLS in production via BYPASSRLS; the table grants below
-- mirror what Supabase hands each role.
grant select on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- The publication the realtime migration adds tables to.
do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;
