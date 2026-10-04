-- API functions (RPCs). All SECURITY DEFINER with a fixed search_path, and
-- each checks permissions itself before doing anything.

-- Small helper for friendly errors the frontend can map to plain English.
create or replace function private.fail(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = p_code;
end;
$$;

-- Keepalive for the daily GitHub Action. Does a real (tiny) query.
create or replace function public.keepalive()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select now() where exists (select 1 from public.project_templates limit 1) or true
$$;

-- The signed-in user's own account (works for pending users, who can read nothing else).
create or replace function public.get_my_account()
returns json
language sql stable security definer
set search_path = ''
as $$
  select json_build_object(
    'id', p.id, 'role', p.role, 'status', p.status, 'email', p.email,
    'full_name', p.full_name, 'avatar_url', p.avatar_url, 'org_id', p.org_id,
    'timezone', p.timezone, 'theme_preference', p.theme_preference,
    'requested_company_name', p.requested_company_name
  )
  from public.profiles p where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Time tracking
-- ---------------------------------------------------------------------------
create or replace function public.start_timer(p_project_id uuid, p_task_id uuid default null)
returns public.time_entries
language plpgsql security definer
set search_path = ''
as $$
declare
  v_entry public.time_entries;
begin
  if not public.can_work_on_project(p_project_id) then
    perform private.fail('not_allowed', 'You are not assigned to this project.');
  end if;
  if exists (select 1 from public.time_entries where user_id = auth.uid() and ended_at is null) then
    perform private.fail('timer_running', 'A timer is already running. Stop it or switch project.');
  end if;
  insert into public.time_entries (user_id, project_id, task_id, started_at)
  values (auth.uid(), p_project_id, p_task_id, now())
  returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.stop_timer(p_handoff_note text default null)
returns public.time_entries
language plpgsql security definer
set search_path = ''
as $$
declare
  v_entry public.time_entries;
begin
  if not public.is_staff() then
    perform private.fail('not_allowed', 'Only team members can track time.');
  end if;
  update public.time_entries
  set ended_at = now(),
      handoff_note = coalesce(nullif(trim(p_handoff_note), ''), handoff_note)
  where user_id = auth.uid() and ended_at is null
  returning * into v_entry;
  return v_entry;
end;
$$;

-- Stops the running entry at now() and starts a new one at the SAME instant
-- (now() is fixed for the whole transaction): no gap, no overlap.
create or replace function public.switch_project(new_project_id uuid, handoff_note text default null)
returns public.time_entries
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_entry public.time_entries;
begin
  if not public.can_work_on_project(new_project_id) then
    perform private.fail('not_allowed', 'You are not assigned to this project.');
  end if;

  -- Lock the running entry (if any) so two parallel switches cannot both win.
  perform 1 from public.time_entries
  where user_id = auth.uid() and ended_at is null
  for update;

  update public.time_entries
  set ended_at = v_now,
      handoff_note = coalesce(nullif(trim(switch_project.handoff_note), ''), time_entries.handoff_note)
  where user_id = auth.uid() and ended_at is null;

  insert into public.time_entries (user_id, project_id, started_at)
  values (auth.uid(), new_project_id, v_now)
  returning * into v_entry;
  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client updates ("Submit to client")
-- ---------------------------------------------------------------------------
create or replace function public.submit_client_update(
  p_project_id uuid, p_message text, p_task_id uuid default null
) returns public.client_updates
language plpgsql security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_status public.update_status;
  v_stage uuid;
  v_author text;
  v_update public.client_updates;
begin
  if not public.can_work_on_project(p_project_id) then
    perform private.fail('not_allowed', 'You are not assigned to this project.');
  end if;
  if char_length(trim(coalesce(p_message, ''))) = 0 then
    perform private.fail('empty_message', 'Please write a short message for the client.');
  end if;

  select * into v_project from public.projects where id = p_project_id;

  if p_task_id is not null then
    select stage_id into v_stage from public.tasks where id = p_task_id and project_id = p_project_id;
    if not found then
      perform private.fail('bad_task', 'That task does not belong to this project.');
    end if;
  end if;
  if v_stage is null then
    select id into v_stage from public.project_stages
    where project_id = p_project_id and status = 'active' order by position limit 1;
  end if;

  select coalesce(full_name, email) into v_author from public.profiles where id = auth.uid();

  v_status := case
    when v_project.require_admin_approval and not public.is_admin() then 'pending_approval'
    else 'published'
  end::public.update_status;

  insert into public.client_updates (project_id, task_id, stage_id, author_id, author_name, message, status, published_at)
  values (
    p_project_id, p_task_id, v_stage, auth.uid(), v_author, trim(p_message), v_status,
    case when v_status = 'published' then now() end
  )
  returning * into v_update;

  if v_status = 'published' then
    perform private.notify_project_clients(
      p_project_id, 'new_update', 'New update on ' || v_project.name,
      v_author || ': ' || trim(p_message), '/client/projects/' || p_project_id, true
    );
  else
    perform private.notify_admins(
      'update_pending_approval', 'Update waiting for approval',
      v_author || ' wrote an update for ' || v_project.name || ': ' || trim(p_message),
      '/admin/approvals', false
    );
  end if;
  return v_update;
end;
$$;

create or replace function public.review_client_update(p_update_id uuid, p_approve boolean)
returns public.client_updates
language plpgsql security definer
set search_path = ''
as $$
declare
  v_update public.client_updates;
  v_project_name text;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can approve updates.');
  end if;
  update public.client_updates
  set status = case when p_approve then 'published' else 'rejected' end::public.update_status,
      reviewed_by = auth.uid(), reviewed_at = now(),
      published_at = case when p_approve then now() end
  where id = p_update_id and status = 'pending_approval'
  returning * into v_update;
  if not found then
    perform private.fail('not_pending', 'This update is not waiting for approval.');
  end if;

  if p_approve then
    select name into v_project_name from public.projects where id = v_update.project_id;
    perform private.notify_project_clients(
      v_update.project_id, 'new_update', 'New update on ' || v_project_name,
      coalesce(v_update.author_name, 'Coherent') || ': ' || v_update.message,
      '/client/projects/' || v_update.project_id, true
    );
  end if;
  if v_update.author_id is not null and v_update.author_id <> auth.uid() then
    perform private.notify(
      v_update.author_id, 'update_reviewed',
      case when p_approve then 'Your update was approved' else 'Your update was not approved' end,
      v_update.message, '/team/projects/' || v_update.project_id, false
    );
  end if;
  return v_update;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Let's Go" kickoff
-- ---------------------------------------------------------------------------
create or replace function public.confirm_kickoff(p_project_id uuid)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_org_name text;
  v_user_name text;
  v_pending text[];
  v_next record;
  v_first_stage uuid;
begin
  if not (public.is_project_client(p_project_id) or public.is_admin()) then
    perform private.fail('not_allowed', 'You cannot start this project.');
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.kickoff_confirmed_at is not null then
    perform private.fail('already_confirmed', 'This project has already been started.');
  end if;

  if exists (
    select 1 from public.access_steps
    where project_id = p_project_id and key = 'webflow' and status = 'pending'
  ) then
    perform private.fail('webflow_pending', 'Please share Webflow access first. We need it to start.');
  end if;

  select coalesce(array_agg(key::text order by position), '{}') into v_pending
  from public.access_steps where project_id = p_project_id and status = 'pending';

  update public.projects
  set kickoff_confirmed_at = now(), kickoff_confirmed_by = auth.uid(), status = 'kickoff_confirmed'
  where id = p_project_id;

  -- Start the first stage quietly (the kickoff messages below cover it).
  if not exists (select 1 from public.project_stages where project_id = p_project_id and status <> 'upcoming') then
    select id into v_first_stage from public.project_stages
    where project_id = p_project_id order by position limit 1;
    if v_first_stage is not null then
      perform set_config('app.quiet_stage_notify', 'on', true);
      update public.project_stages set status = 'active' where id = v_first_stage;
      perform set_config('app.quiet_stage_notify', 'off', true);
    end if;
  end if;

  select coalesce(full_name, email) into v_user_name from public.profiles where id = auth.uid();
  select name into v_org_name from public.organizations where id = v_project.org_id;

  -- Timeline entry.
  insert into public.client_updates (project_id, author_id, author_name, message, kind, status, published_at)
  values (p_project_id, auth.uid(), v_user_name, 'Project started', 'milestone', 'published', now());

  -- Tell the team and admins (bell + email).
  perform private.notify_project_staff(
    p_project_id, 'kickoff_confirmed',
    v_org_name || ' is ready to start ' || v_project.name,
    v_user_name || ' pressed "Let''s Go". The client has asked to start the project.'
      || case when array_length(v_pending, 1) > 0
           then ' Still pending: ' || array_to_string(v_pending, ', ') || '.' else '' end,
    '/team/projects/' || p_project_id, true
  );

  -- Kickoff summary for the client (bell + email).
  select name, due_date into v_next from public.project_stages
  where project_id = p_project_id and status <> 'done'
  order by position offset 1 limit 1;

  perform private.notify(
    auth.uid(), 'kickoff_confirmed', 'Your project has started: ' || v_project.name,
    'Thanks! Here is your kickoff summary.' || chr(10)
      || 'Start date: ' || coalesce(to_char(coalesce(v_project.start_date, current_date), 'FMMonth FMDD, YYYY'), 'today') || chr(10)
      || 'Next milestone: ' || coalesce(v_next.name, 'We will confirm soon')
      || coalesce(' (' || to_char(v_next.due_date, 'FMMonth FMDD, YYYY') || ')', '') || chr(10)
      || 'Due date: ' || coalesce(to_char(v_project.due_date, 'FMMonth FMDD, YYYY'), 'We will confirm soon'),
    '/client/projects/' || p_project_id, true
  );

  return json_build_object('ok', true, 'pending_steps', v_pending);
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects and stages
-- ---------------------------------------------------------------------------
create or replace function public.create_project_from_template(
  p_org_id uuid,
  p_name text,
  p_template public.project_template,
  p_start_date date default null,
  p_due_date date default null,
  p_member_ids uuid[] default '{}'
) returns public.projects
language plpgsql security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_template_id uuid;
  r record;
  v_stage_id uuid;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can create projects.');
  end if;

  insert into public.projects (org_id, name, template, start_date, due_date, created_by)
  values (p_org_id, trim(p_name), p_template, p_start_date, p_due_date, auth.uid())
  returning * into v_project;

  select id into v_template_id from public.project_templates where key = p_template;

  if v_template_id is not null then
    for r in select * from public.template_items where template_id = v_template_id and kind = 'stage' order by position loop
      insert into public.project_stages (project_id, name, position) values (v_project.id, r.name, r.position);
    end loop;
    for r in select * from public.template_items where template_id = v_template_id and kind = 'task' order by position loop
      select id into v_stage_id from public.project_stages where project_id = v_project.id and name = r.stage_name limit 1;
      insert into public.tasks (project_id, stage_id, title, position) values (v_project.id, v_stage_id, r.name, r.position);
    end loop;
    for r in select * from public.template_items where template_id = v_template_id and kind = 'access_step' order by position loop
      insert into public.access_steps (project_id, key, position) values (v_project.id, r.access_key, r.position)
      on conflict (project_id, key) do nothing;
    end loop;
  end if;

  insert into public.project_members (project_id, user_id)
  select v_project.id, u from unnest(coalesce(p_member_ids, '{}')) as u
  where exists (select 1 from public.profiles p where p.id = u and p.role in ('admin', 'team') and p.status = 'approved')
  on conflict do nothing;

  select current_stage into v_project.current_stage from public.projects where id = v_project.id;
  return v_project;
end;
$$;

-- Finish the active stage and start the next one.
create or replace function public.advance_stage(p_project_id uuid)
returns public.project_stages
language plpgsql security definer
set search_path = ''
as $$
declare
  v_active public.project_stages;
  v_next public.project_stages;
begin
  if not public.can_work_on_project(p_project_id) then
    perform private.fail('not_allowed', 'You are not assigned to this project.');
  end if;

  select * into v_active from public.project_stages
  where project_id = p_project_id and status = 'active' order by position limit 1;
  if found then
    update public.project_stages set status = 'done' where id = v_active.id;
  end if;

  select * into v_next from public.project_stages
  where project_id = p_project_id and status = 'upcoming'
    and (v_active.id is null or position >= v_active.position)
  order by position limit 1;

  if found then
    update public.project_stages set status = 'active' where id = v_next.id returning * into v_next;
    update public.projects set status = 'in_progress'
    where id = p_project_id and status in ('onboarding', 'kickoff_confirmed');
  else
    update public.projects set status = 'completed', current_stage = null where id = p_project_id;
    perform private.notify_project_clients(
      p_project_id, 'stage_changed', 'Your project is complete',
      'Every stage is done. Thank you for working with Coherent!', '/client/projects/' || p_project_id, true
    );
  end if;
  return v_next;
end;
$$;

-- Percent complete (tasks done / tasks; falls back to stages). Null if not visible.
create or replace function public.project_progress(p_project_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select case
    when not public.can_view_project(p_project_id) then null
    when (select count(*) from public.tasks where project_id = p_project_id) > 0 then
      (select round(100.0 * count(*) filter (where status = 'done') / count(*))::int
       from public.tasks where project_id = p_project_id)
    when (select count(*) from public.project_stages where project_id = p_project_id) > 0 then
      (select round(100.0 * count(*) filter (where status = 'done') / count(*))::int
       from public.project_stages where project_id = p_project_id)
    else 0
  end
$$;

-- ---------------------------------------------------------------------------
-- Client requests
-- ---------------------------------------------------------------------------
create or replace function public.submit_client_request(
  p_kind public.request_kind, p_title text, p_details text default null,
  p_project_id uuid default null, p_page_url text default null
) returns public.client_requests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := public.client_org_id();
  v_req public.client_requests;
  v_who text;
  v_org_name text;
begin
  if v_org is null then
    perform private.fail('not_allowed', 'Your account is not linked to a company yet.');
  end if;
  if p_project_id is not null and not public.is_project_client(p_project_id) then
    perform private.fail('not_allowed', 'That project is not yours.');
  end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 then
    perform private.fail('empty_title', 'Please add a short title.');
  end if;

  insert into public.client_requests (org_id, project_id, author_id, kind, title, details, page_url)
  values (v_org, p_project_id, auth.uid(), p_kind, trim(p_title), nullif(trim(p_details), ''), nullif(trim(p_page_url), ''))
  returning * into v_req;

  select coalesce(full_name, email) into v_who from public.profiles where id = auth.uid();
  select name into v_org_name from public.organizations where id = v_org;
  perform private.notify_admins(
    case when p_kind = 'bug' then 'client_bug' else 'client_request' end,
    case when p_kind = 'bug' then 'Bug report from ' else 'New request from ' end || v_org_name,
    v_who || ': ' || trim(p_title),
    '/admin/requests', true
  );
  return v_req;
end;
$$;
