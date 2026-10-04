-- Email queue helpers for the send-email Edge Function (service role only).

-- Claim up to p_limit emails to send. Rows stuck in 'sending' for 10+ minutes
-- (e.g. the function crashed) are retried. SKIP LOCKED makes parallel runs safe.
create or replace function public.claim_email_batch(p_limit int default 20)
returns setof public.email_outbox
language plpgsql security definer
set search_path = ''
as $$
begin
  return query
  update public.email_outbox o
  set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where (status = 'queued' or (status = 'sending' and created_at < now() - interval '10 minutes'))
      and attempts < 5
    order by created_at
    limit greatest(0, least(p_limit, 100))
    for update skip locked
  )
  returning o.*;
end;
$$;

-- How many emails went out today (UTC). Used to respect the Resend free tier (100/day).
create or replace function public.emails_sent_today()
returns int
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.email_outbox
  where status = 'sent' and sent_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
$$;

revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
revoke execute on function public.emails_sent_today() from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;
grant execute on function public.emails_sent_today() to service_role;
