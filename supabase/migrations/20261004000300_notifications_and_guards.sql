-- Notification helpers, field guards and business-rule triggers.

-- ---------------------------------------------------------------------------
-- Notification helpers (private: not callable from the API)
-- ---------------------------------------------------------------------------

-- Bell notification, plus an email queued in email_outbox when p_email is true.
create or replace function private.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_email boolean default false
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);

  if p_email then
    select coalesce(p.email, u.email) into v_email
    from public.profiles p left join auth.users u on u.id = p.id
    where p.id = p_user_id;
    if v_email is not null then
      insert into public.email_outbox (user_id, to_email, kind, subject, heading, body, cta_label, cta_path)
      values (p_user_id, v_email, p_type, p_title, p_title, coalesce(p_body, ''), 'Open the portal', p_link);
    end if;
  end if;
end;
$$;

-- Email only (no bell), e.g. a kickoff summary.
create or replace function private.queue_email(
  p_user_id uuid,
  p_kind text,
  p_subject text,
  p_body text,
  p_link text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select coalesce(p.email, u.email) into v_email
  from public.profiles p left join auth.users u on u.id = p.id
  where p.id = p_user_id;
  if v_email is not null then
    insert into public.email_outbox (user_id, to_email, kind, subject, heading, body, cta_label, cta_path)
    values (p_user_id, v_email, p_kind, p_subject, p_subject, p_body, 'Open the portal', p_link);
  end if;
end;
$$;

-- All approved client users of the project's organization.
create or replace function private.notify_project_clients(
  p_project_id uuid, p_type text, p_title text, p_body text, p_link text, p_email boolean default true
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
    join public.projects pr on pr.org_id = p.org_id
    where pr.id = p_project_id and p.role = 'client' and p.status = 'approved'
  loop
    perform private.notify(r.id, p_type, p_title, p_body, p_link, p_email);
  end loop;
end;
$$;

-- Assigned team members plus all admins (deduplicated), optionally excluding someone.
create or replace function private.notify_project_staff(
  p_project_id uuid, p_type text, p_title text, p_body text, p_link text,
  p_email boolean default false, p_exclude uuid default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select distinct p.id from public.profiles p
    where p.status = 'approved'
      and p.id is distinct from p_exclude
      and (
        p.role = 'admin'
        or (p.role = 'team' and exists (
          select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = p.id
        ))
      )
  loop
    perform private.notify(r.id, p_type, p_title, p_body, p_link, p_email);
  end loop;
end;
$$;

create or replace function private.notify_admins(
  p_type text, p_title text, p_body text, p_link text, p_email boolean default false
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select p.id from public.profiles p where p.role = 'admin' and p.status = 'approved' loop
    perform private.notify(r.id, p_type, p_title, p_body, p_link, p_email);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guards: what each role may change when writing tables directly via the API.
-- These are SECURITY INVOKER on purpose: current_user is 'authenticated' for API
-- calls and the table owner when called from our own SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------

create or replace function private.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.org_id is distinct from old.org_id
       or new.email is distinct from old.email
       or new.requested_company_name is distinct from old.requested_company_name
       or new.signup_source is distinct from old.signup_source then
      raise exception 'You can only change your own name, photo, timezone and theme.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

create or replace function private.projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.org_id is distinct from old.org_id
       or new.name is distinct from old.name
       or new.template is distinct from old.template
       or new.start_date is distinct from old.start_date
       or new.due_date is distinct from old.due_date
       or new.require_admin_approval is distinct from old.require_admin_approval
       or new.kickoff_confirmed_at is distinct from old.kickoff_confirmed_at
       or new.kickoff_confirmed_by is distinct from old.kickoff_confirmed_by
       or new.created_by is distinct from old.created_by
       or new.last_access_reminder_at is distinct from old.last_access_reminder_at then
      raise exception 'Only an admin can change these project settings.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger projects_guard before update on public.projects
  for each row execute function private.projects_guard();

create or replace function private.access_steps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  if new.project_id is distinct from old.project_id or new.key is distinct from old.key then
    raise exception 'Access steps cannot be moved.' using errcode = '42501';
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  if current_user in ('authenticated', 'anon') then
    v_changed := (new.status, new.value_text, new.fields, new.note)
      is distinct from (old.status, old.value_text, old.fields, old.note);

    if public.is_admin() then
      -- Admin edits on behalf of the client are tagged.
      if v_changed and new.status in ('provided', 'skipped') then
        new.provided_by := 'admin';
      elsif new.status = 'pending' then
        new.provided_by := null;
      end if;
    elsif public.is_staff() then
      if new.value_text is distinct from old.value_text
         or new.fields is distinct from old.fields
         or new.provided_by is distinct from old.provided_by then
        raise exception 'Team members can only mark a step as verified.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status
         and not (new.status = 'verified' or (old.status = 'verified' and new.status = 'provided')) then
        raise exception 'Team members can only mark a step as verified.' using errcode = '42501';
      end if;
    else
      -- Client
      if old.status = 'verified' and v_changed then
        raise exception 'Our team already checked this step. Contact us if something changed.' using errcode = '42501';
      end if;
      if new.status = 'verified' then
        raise exception 'Only the Coherent team can mark a step as verified.' using errcode = '42501';
      end if;
      new.provided_by := case when new.status in ('provided', 'skipped') then 'client'::public.provided_by else null end;
    end if;
  end if;
  return new;
end;
$$;
create trigger access_steps_guard before update on public.access_steps
  for each row execute function private.access_steps_guard();

-- ---------------------------------------------------------------------------
-- Business rules
-- ---------------------------------------------------------------------------

-- Due date changes are recorded and the client is told.
create or replace function private.projects_after_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.due_date is distinct from old.due_date then
    insert into public.project_due_date_changes (project_id, old_date, new_date, changed_by)
    values (new.id, old.due_date, new.due_date, auth.uid());
  end if;
  return new;
end;
$$;
create trigger projects_after_update after update on public.projects
  for each row execute function private.projects_after_update();

create or replace function private.due_date_change_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select name into v_name from public.projects where id = new.project_id;
  perform private.notify_project_clients(
    new.project_id,
    'due_date_changed',
    'New due date for ' || v_name,
    case
      when new.new_date is null then 'The due date was removed. We will share a new date soon.'
      else 'Your project is now due on ' || to_char(new.new_date, 'FMMonth FMDD, YYYY') || '.'
    end,
    '/client/projects/' || new.project_id,
    true
  );
  return new;
end;
$$;
create trigger due_date_change_notify after insert on public.project_due_date_changes
  for each row execute function private.due_date_change_notify();

-- Stage timestamps.
create or replace function private.stages_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'active' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
      new.started_at := coalesce(new.started_at, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger stages_before_write before insert or update on public.project_stages
  for each row execute function private.stages_before_write();

-- When a stage becomes active: update the project's current stage and tell the client.
create or replace function private.stages_after_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_project_name text;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.projects set current_stage = new.name where id = new.project_id
    returning name into v_project_name;
    if coalesce(current_setting('app.quiet_stage_notify', true), '') <> 'on' then
      perform private.notify_project_clients(
        new.project_id,
        'stage_changed',
        v_project_name || ' moved to ' || new.name,
        'Your project is now in the ' || new.name || ' stage.',
        '/client/projects/' || new.project_id,
        true
      );
    end if;
  end if;
  return new;
end;
$$;
create trigger stages_after_update after update on public.project_stages
  for each row execute function private.stages_after_update();

-- ---------------------------------------------------------------------------
-- Scheduled jobs (run by pg_cron, see the cron migration)
-- ---------------------------------------------------------------------------

-- Stop timers that ran for more than 8 hours and flag them.
create or replace function private.auto_stop_long_timers()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    update public.time_entries
    set ended_at = started_at + interval '8 hours', auto_stopped = true
    where ended_at is null and started_at < now() - interval '8 hours'
    returning id, user_id, project_id
  loop
    v_count := v_count + 1;
    perform private.notify(
      r.user_id, 'timer_auto_stopped', 'Your timer was stopped after 8 hours',
      'It looked like the timer was left running, so we stopped it at 8 hours. Please check the entry.',
      '/team', false
    );
  end loop;
  return v_count;
end;
$$;

-- Remind clients about pending access steps: 3+ days after project creation, max once per 3 days.
create or replace function private.queue_access_reminders()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select pr.id, pr.name,
      (select count(*) from public.access_steps s where s.project_id = pr.id and s.status = 'pending') as pending
    from public.projects pr
    where pr.created_at <= now() - interval '3 days'
      and (pr.last_access_reminder_at is null or pr.last_access_reminder_at <= now() - interval '3 days')
      and pr.status not in ('completed', 'on_hold')
      and exists (select 1 from public.access_steps s where s.project_id = pr.id and s.status = 'pending')
    for update of pr skip locked
  loop
    perform private.notify_project_clients(
      r.id, 'access_reminder',
      'A few access steps are still waiting',
      r.pending || ' access step(s) for ' || r.name || ' still need your help. It only takes a few minutes.',
      '/client/projects/' || r.id || '/access',
      true
    );
    update public.projects set last_access_reminder_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
