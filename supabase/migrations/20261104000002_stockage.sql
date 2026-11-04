-- Photos de reçus : bucket privé, un dossier par utilisateur (<user_id>/<fichier>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recus', 'recus', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy recus_proprietaire_lecture on storage.objects for select to authenticated
  using (bucket_id = 'recus' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recus_proprietaire_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'recus' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recus_proprietaire_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'recus' and (storage.foldername(name))[1] = (select auth.uid())::text);
