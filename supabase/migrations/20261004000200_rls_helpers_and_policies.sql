-- Row Level Security: helper functions and policies.
--
-- Helpers are SECURITY DEFINER with an empty search_path so they can read
-- profiles/project_members without triggering RLS recursion, and so nobody
-- can hijack them with a malicious search_path.
--
-- Every helper only returns something for APPROVED accounts. Pending or
-- rejected accounts therefore match no policy and can read nothing.

create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'approved'
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'team'), false)
$$;

-- Org of the signed-in client, or null (not a client, not approved, or not linked yet).
create or replace function public.client_org_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.org_id from public.profiles p
  where p.id = auth.uid() and p.role = 'client' and p.status = 'approved'
$$;

-- True when the signed-in staff member is assigned to the project.
create or replace function public.is_assigned(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  )
$$;

-- Admin, or staff assigned to the project.
create or replace function public.can_work_on_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or public.is_assigned(p_project_id)
$$;

-- Client of the project's organization.
create or replace function public.is_project_client(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and pr.org_id = public.client_org_id()
  )
$$;

create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.can_work_on_project(p_project_id) or public.is_project_client(p_project_id)
$$;

-- Which profiles may the current user see?
create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with me as (select public.current_app_role() as role, public.client_org_id() as org)
  select case
    when (select role from me) is null then false
    when p_profile_id = auth.uid() then true
    when (select role from me) = 'admin' then true
    when (select role from me) = 'team' then exists (
      select 1 from public.profiles t
      where t.id = p_profile_id and (
        t.role in ('admin', 'team')
        or t.org_id in (
          select pr.org_id from public.projects pr
          join public.project_members m on m.project_id = pr.id
          where m.user_id = auth.uid()
        )
      )
    )
    when (select org from me) is not null then exists (
      select 1 from public.profiles t
      where t.id = p_profile_id and (
        t.org_id = (select org from me)
        or (
          t.role in ('admin', 'team') and t.status = 'approved' and exists (
            select 1 from public.project_members m
            join public.projects pr on pr.id = m.project_id
            where m.user_id = t.id and pr.org_id = (select org from me)
          )
        )
      )
    )
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_due_date_changes enable row level security;
alter table public.tasks enable row level security;
alter table public.client_updates enable row level security;
alter table public.internal_notes enable row level security;
alter table public.access_steps enable row level security;
alter table public.time_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.project_templates enable row level security;
alter table public.template_items enable row level security;
alter table public.client_requests enable row level security;
alter table public.email_outbox enable row level security;

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_view_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and public.current_app_role() is not null) or public.is_admin())
  with check ((id = (select auth.uid()) and public.current_app_role() is not null) or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- organizations ---------------------------------------------------------------
create policy organizations_select on public.organizations for select to authenticated
  using (
    public.is_admin()
    or id = public.client_org_id()
    or (public.is_staff() and exists (
      select 1 from public.projects pr where pr.org_id = organizations.id and public.is_assigned(pr.id)
    ))
  );
create policy organizations_insert on public.organizations for insert to authenticated
  with check (public.is_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_admin() or id = public.client_org_id())
  with check (public.is_admin() or id = public.client_org_id());
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.is_admin());

-- projects --------------------------------------------------------------------
create policy projects_select on public.projects for select to authenticated
  using (public.is_admin() or public.is_assigned(id) or org_id = public.client_org_id());
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated
  using (public.can_work_on_project(id))
  with check (public.can_work_on_project(id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_admin());

-- project_members -------------------------------------------------------------
create policy project_members_select on public.project_members for select to authenticated
  using (public.can_view_project(project_id));
create policy project_members_write on public.project_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- project_stages --------------------------------------------------------------
create policy project_stages_select on public.project_stages for select to authenticated
  using (public.can_view_project(project_id));
create policy project_stages_insert on public.project_stages for insert to authenticated
  with check (public.can_work_on_project(project_id));
create policy project_stages_update on public.project_stages for update to authenticated
  using (public.can_work_on_project(project_id)) with check (public.can_work_on_project(project_id));
create policy project_stages_delete on public.project_stages for delete to authenticated
  using (public.can_work_on_project(project_id));

-- project_due_date_changes (written by trigger only) ---------------------------
create policy due_date_changes_select on public.project_due_date_changes for select to authenticated
  using (public.can_view_project(project_id));

-- tasks (staff only) ----------------------------------------------------------
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_work_on_project(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_work_on_project(project_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_work_on_project(project_id)) with check (public.can_work_on_project(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.can_work_on_project(project_id));

-- client_updates (written through RPCs only) -----------------------------------
create policy client_updates_select on public.client_updates for select to authenticated
  using (
    public.can_work_on_project(project_id)
    or (status = 'published' and public.is_project_client(project_id))
  );
create policy client_updates_delete on public.client_updates for delete to authenticated
  using (public.is_admin());

-- internal_notes (never clients) ----------------------------------------------
create policy internal_notes_select on public.internal_notes for select to authenticated
  using (public.can_work_on_project(project_id));
create policy internal_notes_insert on public.internal_notes for insert to authenticated
  with check (public.can_work_on_project(project_id) and author_id = (select auth.uid()));
create policy internal_notes_update on public.internal_notes for update to authenticated
  using (public.can_work_on_project(project_id) and (author_id = (select auth.uid()) or public.is_admin()))
  with check (public.can_work_on_project(project_id));
create policy internal_notes_delete on public.internal_notes for delete to authenticated
  using (public.can_work_on_project(project_id) and (author_id = (select auth.uid()) or public.is_admin()));

-- access_steps ----------------------------------------------------------------
-- Which columns each role may change is enforced by trigger access_steps_guard.
create policy access_steps_select on public.access_steps for select to authenticated
  using (public.can_view_project(project_id));
create policy access_steps_update on public.access_steps for update to authenticated
  using (public.can_work_on_project(project_id) or public.is_project_client(project_id))
  with check (public.can_work_on_project(project_id) or public.is_project_client(project_id));
create policy access_steps_insert on public.access_steps for insert to authenticated
  with check (public.is_admin());
create policy access_steps_delete on public.access_steps for delete to authenticated
  using (public.is_admin());

-- time_entries (own entries; admin sees all; clients never) --------------------
-- Starting/stopping goes through RPCs (start_timer, stop_timer, switch_project).
create policy time_entries_select on public.time_entries for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_staff()) or public.is_admin());
create policy time_entries_admin_write on public.time_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- notifications (own) ---------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.current_app_role() is not null);
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.current_app_role() is not null)
  with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- audit_log (admin only, read only) -------------------------------------------
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- templates -------------------------------------------------------------------
create policy project_templates_select on public.project_templates for select to authenticated
  using (public.is_staff());
create policy project_templates_write on public.project_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy template_items_select on public.template_items for select to authenticated
  using (public.is_staff());
create policy template_items_write on public.template_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- client_requests -------------------------------------------------------------
create policy client_requests_select on public.client_requests for select to authenticated
  using (
    public.is_admin()
    or org_id = public.client_org_id()
    or (project_id is not null and public.is_assigned(project_id))
  );
create policy client_requests_update on public.client_requests for update to authenticated
  using (public.is_admin() or (project_id is not null and public.is_assigned(project_id)))
  with check (public.is_admin() or (project_id is not null and public.is_assigned(project_id)));

-- email_outbox (admin can look; only the database and Edge Function write) ----
create policy email_outbox_select on public.email_outbox for select to authenticated
  using (public.is_admin());
