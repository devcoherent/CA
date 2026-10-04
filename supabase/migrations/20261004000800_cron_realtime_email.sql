-- Realtime for the notification bell, scheduled jobs (pg_cron), and the
-- trigger that wakes the send-email Edge Function (pg_net).
-- Every block is guarded so the migration also runs on a plain Postgres.

-- Realtime: the bell listens to new notifications (RLS still applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- Wake the Edge Function so queued emails go out right away.
-- Needs two rows in private.app_settings (see README):
--   email_function_url   = https://<ref>.supabase.co/functions/v1/send-email
--   email_webhook_secret = a long random string, same as the function's EMAIL_WEBHOOK_SECRET
create or replace function private.kick_email_sender()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  select value into v_url from private.app_settings where key = 'email_function_url';
  select value into v_secret from private.app_settings where key = 'email_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  if not exists (select 1 from public.email_outbox where status = 'queued') then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
  using v_url, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
end;
$$;

create or replace function private.email_outbox_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.kick_email_sender();
  return null;
end;
$$;

create trigger email_outbox_kick after insert on public.email_outbox
  for each statement execute function private.email_outbox_after_insert();

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

-- Scheduled jobs. pg_cron is available on the Supabase free tier.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('auto-stop-long-timers', '*/10 * * * *', 'select private.auto_stop_long_timers()');
    perform cron.schedule('access-step-reminders', '15 9 * * *', 'select private.queue_access_reminders()');
    -- Safety net: retry queued emails (e.g. after hitting the daily cap).
    perform cron.schedule('send-queued-emails', '*/15 * * * *', 'select private.kick_email_sender()');
  else
    raise notice 'pg_cron not available: run select public.run_maintenance() on a schedule instead';
  end if;
end;
$$;

-- Fallback for environments without pg_cron. Only the service role may call it.
create or replace function public.run_maintenance()
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_stopped int;
  v_reminded int;
begin
  v_stopped := private.auto_stop_long_timers();
  v_reminded := private.queue_access_reminders();
  perform private.kick_email_sender();
  return json_build_object('timers_stopped', v_stopped, 'reminders_sent', v_reminded);
end;
$$;
