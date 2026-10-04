-- Explicit privileges. RLS decides WHICH rows; these decide WHICH operations.
-- Keep this migration last: re-run its statements after adding new tables.

-- Visitors who are not logged in (anon) get nothing except the keepalive ping.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Logged-in users: plain CRUD only (no TRUNCATE/TRIGGER/REFERENCES, which bypass or sidestep RLS).
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Service role (Edge Functions, server only).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Maintenance is server-only; keepalive is public.
revoke execute on function public.run_maintenance() from authenticated;
grant execute on function public.keepalive() to anon;

-- Internal schema: nobody but the owner.
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
