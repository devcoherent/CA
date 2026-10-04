// Row types for the tables the app reads. Kept by hand to match supabase/migrations.

export type Role = 'admin' | 'team' | 'client'
export type AccountStatus = 'approved' | 'pending' | 'rejected'
export type ProjectTemplateKey = 'webflow_build' | 'seo_audit' | 'custom'
export type ProjectStatus = 'onboarding' | 'kickoff_confirmed' | 'in_progress' | 'on_hold' | 'completed'
export type StageStatus = 'upcoming' | 'active' | 'done'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type UpdateStatus = 'published' | 'pending_approval' | 'rejected'
export type AccessKey = 'webflow' | 'domain_dns' | 'gtm' | 'ga4' | 'gsc' | 'brand_assets'
export type AccessStatus = 'pending' | 'provided' | 'skipped' | 'verified'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Account {
  id: string
  role: Role
  status: AccountStatus
  email: string | null
  full_name: string | null
  avatar_url: string | null
  org_id: string | null
  timezone: string
  theme_preference: ThemePreference
  requested_company_name: string | null
}

export interface Profile extends Account {
  signup_source: string | null
  created_at: string
}

export interface Organization {
  id: string
  name: string
  bio: string | null
  logo_url: string | null
  billing_email: string | null
  timezone: string
  created_at: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  template: ProjectTemplateKey
  status: ProjectStatus
  current_stage: string | null
  start_date: string | null
  due_date: string | null
  kickoff_confirmed_at: string | null
  kickoff_confirmed_by: string | null
  require_admin_approval: boolean
  webvizio_url: string | null
  staging_url: string | null
  created_at: string
  organizations?: Pick<Organization, 'id' | 'name' | 'logo_url'> | null
}

export interface Stage {
  id: string
  project_id: string
  name: string
  position: number
  status: StageStatus
  due_date: string | null
  started_at: string | null
  completed_at: string | null
}

export interface Task {
  id: string
  project_id: string
  stage_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  status: TaskStatus
  due_date: string | null
  position: number
  created_at: string
}

export interface ClientUpdate {
  id: string
  project_id: string
  task_id: string | null
  stage_id: string | null
  author_id: string | null
  author_name: string | null
  message: string
  kind: 'update' | 'milestone'
  status: UpdateStatus
  published_at: string | null
  created_at: string
  reviewed_at: string | null
}

export interface InternalNote {
  id: string
  project_id: string
  author_id: string | null
  body: string
  created_at: string
}

export interface AccessStep {
  id: string
  project_id: string
  key: AccessKey
  position: number
  status: AccessStatus
  value_text: string | null
  fields: Record<string, string>
  note: string | null
  provided_by: 'client' | 'admin' | null
  updated_by: string | null
  updated_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  project_id: string
  task_id: string | null
  started_at: string
  ended_at: string | null
  auto_stopped: boolean
  handoff_note: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface AuditEntry {
  id: number
  actor_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface ProjectTemplate {
  id: string
  key: ProjectTemplateKey
  name: string
  description: string | null
}

export interface TemplateItem {
  id: string
  template_id: string
  kind: 'stage' | 'task' | 'access_step'
  name: string
  position: number
  stage_name: string | null
  access_key: AccessKey | null
}

export interface ClientRequest {
  id: string
  org_id: string
  project_id: string | null
  author_id: string | null
  kind: 'request' | 'bug'
  title: string
  details: string | null
  page_url: string | null
  status: 'open' | 'done'
  created_at: string
}

export interface StaffInvite {
  id: string
  email: string
  role: 'admin' | 'team'
  created_at: string
  used_at: string | null
}

export interface DueDateChange {
  id: string
  project_id: string
  old_date: string | null
  new_date: string | null
  changed_at: string
}
