-- Storage: small images only (logos and avatars). 2 MB max, image types only.
-- Deliverables are links (Figma, Drive, staging URLs), never uploaded files.
-- SVG is not allowed because it can carry scripts.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found, skipping storage setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Avatars: users manage files in the folder named after their user id. Admin can manage all.
  execute $p$
    create policy avatars_read on storage.objects for select to authenticated
      using (bucket_id = 'avatars')
  $p$;
  execute $p$
    create policy avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  $p$;
  execute $p$
    create policy avatars_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  $p$;
  execute $p$
    create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  $p$;

  -- Logos: clients manage files in the folder named after their org id. Admin can manage all.
  execute $p$
    create policy logos_read on storage.objects for select to authenticated
      using (bucket_id = 'logos')
  $p$;
  execute $p$
    create policy logos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'logos' and ((storage.foldername(name))[1] = public.client_org_id()::text or public.is_admin()))
  $p$;
  execute $p$
    create policy logos_update on storage.objects for update to authenticated
      using (bucket_id = 'logos' and ((storage.foldername(name))[1] = public.client_org_id()::text or public.is_admin()))
  $p$;
  execute $p$
    create policy logos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'logos' and ((storage.foldername(name))[1] = public.client_org_id()::text or public.is_admin()))
  $p$;
end;
$$;
