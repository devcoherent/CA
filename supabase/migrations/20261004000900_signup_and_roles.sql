-- Signup and roles.
--
-- The role is decided ONLY here, inside the database. Nothing the browser sends
-- (query params, user metadata such as {"role": "admin"}) can grant a role:
--   1. Email is in staff_invites      -> that role (admin/team), approved; invite marked used.
--   2. Else signed up via client form -> client, approved, org_id NULL (sees nothing until linked).
--      (The client form is the only one that sends company_name.)
--   3. Else (team form, not invited)  -> team, PENDING. Pending accounts match no RLS policy.
-- The first admin is created by hand with SQL (see README). The app has no way to become admin.

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email)) and email like '%_@_%'),
  role public.user_role not null check (role in ('admin', 'team')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.staff_invites enable row level security;

create policy staff_invites_admin on public.staff_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profile creation on signup
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email text := lower(trim(new.email));
  v_name text := nullif(left(trim(v_meta ->> 'full_name'), 200), '');
  v_company text := nullif(left(trim(v_meta ->> 'company_name'), 200), '');
  v_invite public.staff_invites;
begin
  select * into v_invite from public.staff_invites
  where email = v_email and used_at is null
  for update;

  if found then
    insert into public.profiles (id, email, full_name, role, status, signup_source)
    values (new.id, v_email, v_name, v_invite.role, 'approved', 'invite');
    update public.staff_invites set used_at = now() where id = v_invite.id;

  elsif v_company is not null then
    insert into public.profiles (id, email, full_name, role, status, org_id, requested_company_name, signup_source)
    values (new.id, v_email, v_name, 'client', 'approved', null, v_company, 'client_form');
    perform private.notify_admins(
      'new_client_signup', 'New client signed up',
      coalesce(v_name, v_email) || ' from ' || v_company || ' is waiting to be linked to an organization.',
      '/admin/users?tab=clients', true
    );

  else
    insert into public.profiles (id, email, full_name, role, status, signup_source)
    values (new.id, v_email, v_name, 'team', 'pending', 'team_form');
    perform private.notify_admins(
      'team_signup_pending', 'Team signup waiting for approval',
      coalesce(v_name, v_email) || ' (' || v_email || ') asked to join the team.',
      '/admin/users?tab=pending', true
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync if a user changes their email in Auth.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Invites: email the person, and upgrade them if they already signed up.
-- ---------------------------------------------------------------------------
create or replace function private.staff_invites_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where lower(email) = new.email;

  if found then
    if v_profile.role <> 'admin' and (v_profile.status <> 'approved' or v_profile.role = 'team') then
      update public.profiles set role = new.role, status = 'approved' where id = v_profile.id;
      update public.staff_invites set used_at = now() where id = new.id;
      perform private.notify(
        v_profile.id, 'account_approved', 'You now have access to the Coherent team app',
        'An admin added you to the team. You can log in now.', '/team', true
      );
    end if;
  else
    insert into public.email_outbox (to_email, kind, subject, heading, body, cta_label, cta_path)
    values (
      new.email, 'staff_invite', 'You are invited to the Coherent team app', 'You are invited',
      'You have been invited to join the Coherent team app. Create your account with this email address to get started.',
      'Create your account', '/signup?role=team'
    );
  end if;
  return new;
end;
$$;

create trigger staff_invites_after_insert after insert on public.staff_invites
  for each row execute function private.staff_invites_after_insert();

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- Approve (becomes team) or reject a pending team signup.
create or replace function public.review_team_member(p_user_id uuid, p_approve boolean)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can do this.');
  end if;
  update public.profiles
  set role = case when p_approve then 'team' else role end::public.user_role,
      status = case when p_approve then 'approved' else 'rejected' end::public.account_status
  where id = p_user_id and status = 'pending' and role = 'team'
  returning * into v_profile;
  if not found then
    perform private.fail('not_pending', 'This person is not waiting for approval.');
  end if;
  if p_approve then
    perform private.notify(p_user_id, 'account_approved', 'Your team account is approved',
      'Welcome to the Coherent team app. You can log in now.', '/team', true);
  else
    perform private.queue_email(p_user_id, 'account_rejected', 'About your Coherent team app request',
      'Your request to join the Coherent team app was not approved. If you think this is a mistake, reply to this email.', '/');
  end if;
  return v_profile;
end;
$$;

-- Link a new client to an existing organization and tell them by email.
create or replace function public.link_client_to_org(p_user_id uuid, p_org_id uuid)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_org_name text;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can do this.');
  end if;
  select name into v_org_name from public.organizations where id = p_org_id;
  if v_org_name is null then
    perform private.fail('no_org', 'That organization does not exist.');
  end if;
  update public.profiles set org_id = p_org_id
  where id = p_user_id and role = 'client'
  returning * into v_profile;
  if not found then
    perform private.fail('not_client', 'Only client accounts can be linked to an organization.');
  end if;
  perform private.notify(p_user_id, 'client_linked', 'Your project space is ready',
    'You now have access to ' || v_org_name || ' on the Coherent client portal.', '/client', true);
  return v_profile;
end;
$$;

-- Create an organization from the client's requested company name, then link them.
create or replace function public.create_org_for_client(p_user_id uuid, p_name text default null)
returns public.organizations
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_org public.organizations;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can do this.');
  end if;
  select * into v_profile from public.profiles where id = p_user_id and role = 'client';
  if not found then
    perform private.fail('not_client', 'Only client accounts can be linked to an organization.');
  end if;
  insert into public.organizations (name, timezone, billing_email)
  values (
    coalesce(nullif(trim(p_name), ''), v_profile.requested_company_name, v_profile.email),
    v_profile.timezone, v_profile.email
  )
  returning * into v_org;
  perform public.link_client_to_org(p_user_id, v_org.id);
  return v_org;
end;
$$;

-- Change someone's role. There must always be at least one admin.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Only an admin can do this.');
  end if;
  if p_role <> 'admin' and exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin' and status = 'approved') <= 1 then
    perform private.fail('last_admin', 'There must always be at least one admin.');
  end if;
  update public.profiles
  set role = p_role,
      status = 'approved',
      org_id = case when p_role = 'client' then org_id else null end
  where id = p_user_id
  returning * into v_profile;
  return v_profile;
end;
$$;
