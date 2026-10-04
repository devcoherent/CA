-- Coherent Agency App: core types and tables.
-- Order matters: later migrations add helpers, RLS, logic and grants.

create extension if not exists pgcrypto with schema extensions;

-- Internal schema: trigger functions, notification helpers, settings.
-- Not exposed through the API; regular users cannot use it.
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'team', 'client');
create type public.account_status as enum ('approved', 'pending', 'rejected');
create type public.project_template as enum ('webflow_build', 'seo_audit', 'custom');
create type public.project_status as enum ('onboarding', 'kickoff_confirmed', 'in_progress', 'on_hold', 'completed');
create type public.stage_status as enum ('upcoming', 'active', 'done');
create type public.task_status as enum ('todo', 'doing', 'done');
create type public.update_status as enum ('published', 'pending_approval', 'rejected');
create type public.access_key as enum ('webflow', 'domain_dns', 'gtm', 'ga4', 'gsc', 'brand_assets');
create type public.access_status as enum ('pending', 'provided', 'skipped', 'verified');
create type public.provided_by as enum ('client', 'admin');
create type public.template_item_kind as enum ('stage', 'task', 'access_step');
create type public.request_kind as enum ('request', 'bug');

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  bio text check (char_length(bio) <= 2000),
  logo_url text check (char_length(logo_url) <= 1000),
  billing_email text check (char_length(billing_email) <= 320),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  status public.account_status not null default 'pending',
  email text,
  full_name text check (char_length(full_name) <= 200),
  avatar_url text check (char_length(avatar_url) <= 1000),
  org_id uuid references public.organizations (id) on delete set null,
  timezone text not null default 'UTC',
  theme_preference text not null default 'system' check (theme_preference in ('light', 'dark', 'system')),
  -- What a new client typed as their company on signup. Shown to admin only;
  -- a client never creates or joins an organization by themselves.
  requested_company_name text check (char_length(requested_company_name) <= 200),
  signup_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles (org_id);
create index profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  template public.project_template not null default 'custom',
  status public.project_status not null default 'onboarding',
  current_stage text,
  start_date date,
  due_date date,
  kickoff_confirmed_at timestamptz,
  kickoff_confirmed_by uuid references public.profiles (id) on delete set null,
  require_admin_approval boolean not null default false,
  webvizio_url text check (char_length(webvizio_url) <= 1000),
  staging_url text check (char_length(staging_url) <= 1000),
  last_access_reminder_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_id_idx on public.projects (org_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  position int not null default 0,
  status public.stage_status not null default 'upcoming',
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_stages_project_idx on public.project_stages (project_id, position);

create table public.project_due_date_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  old_date date,
  new_date date,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index due_date_changes_project_idx on public.project_due_date_changes (project_id, changed_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.project_stages (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'todo',
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id, status, position);

-- "Submit to client" feed.
create table public.client_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  stage_id uuid references public.project_stages (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  -- Snapshot so clients always see who wrote it, even if the author leaves the project.
  author_name text,
  message text not null check (char_length(trim(message)) between 1 and 1000),
  kind text not null default 'update' check (kind in ('update', 'milestone')),
  status public.update_status not null default 'published',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index client_updates_project_idx on public.client_updates (project_id, created_at desc);
create index client_updates_status_idx on public.client_updates (status);

-- Never visible to clients.
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index internal_notes_project_idx on public.internal_notes (project_id, created_at desc);

-- Access onboarding. Stores IDs, links and status ONLY. Never passwords or tokens.
create table public.access_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key public.access_key not null,
  position int not null default 0,
  status public.access_status not null default 'pending',
  value_text text check (char_length(value_text) <= 500),
  -- Extra ID-only fields (e.g. {"registrar": "Namecheap"}). Keys are defined in the frontend.
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and char_length(fields::text) <= 2000),
  note text check (char_length(note) <= 1000),
  provided_by public.provided_by,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, key),
  constraint skipped_needs_note check (status <> 'skipped' or char_length(trim(coalesce(note, ''))) > 0)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  auto_stopped boolean not null default false,
  handoff_note text check (char_length(handoff_note) <= 1000),
  created_at timestamptz not null default now(),
  constraint ended_after_started check (ended_at is null or ended_at >= started_at)
);
-- One running timer per person.
create unique index time_entries_one_running_per_user on public.time_entries (user_id) where ended_at is null;
create index time_entries_started_idx on public.time_entries (started_at desc);
create index time_entries_project_idx on public.time_entries (project_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  key public.project_template not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  kind public.template_item_kind not null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  position int not null default 0,
  -- For tasks: the name of the stage the task belongs to.
  stage_name text,
  -- For access steps: which step.
  access_key public.access_key,
  constraint access_item_has_key check (kind <> 'access_step' or access_key is not null)
);
create index template_items_template_idx on public.template_items (template_id, kind, position);

-- ---------------------------------------------------------------------------
-- Client requests (new request or bug from the client)
-- ---------------------------------------------------------------------------
create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  kind public.request_kind not null default 'request',
  title text not null check (char_length(trim(title)) between 1 and 200),
  details text check (char_length(details) <= 5000),
  page_url text check (char_length(page_url) <= 1000),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index client_requests_org_idx on public.client_requests (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Email outbox: rows are sent by the `send-email` Edge Function (Resend).
-- ---------------------------------------------------------------------------
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  kind text not null,
  subject text not null,
  heading text,
  body text not null,
  cta_label text,
  cta_path text,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_status_idx on public.email_outbox (status, created_at);

-- Private key/value settings (e.g. Edge Function URL). Readable only by the database owner.
create table private.app_settings (
  key text primary key,
  value text not null
);

-- updated_at helper
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();
