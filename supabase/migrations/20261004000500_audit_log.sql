-- Audit log, filled by triggers. Only admins can read it (see RLS migration).

create or replace function private.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  insert into public.audit_log (actor_id, entity_type, entity_id, action, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    lower(tg_op),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_access_steps after insert or update or delete on public.access_steps
  for each row execute function private.audit_row();
create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function private.audit_row();
create trigger audit_due_date_changes after insert or update or delete on public.project_due_date_changes
  for each row execute function private.audit_row();
create trigger audit_client_updates after insert or update or delete on public.client_updates
  for each row execute function private.audit_row();
