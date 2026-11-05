-- Import d'un relevé en une seule transaction SQL : la trace de l'import et ses lignes entrent ensemble,
-- ou rien n'entre. Les empreintes déjà connues sont écartées sans erreur (réimport sans doublon).
create function public.importer_releve(
  p_nom_fichier text,
  p_format public.format_import,
  p_lues int,
  p_lignes jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import uuid;
  v_n int;
begin
  if jsonb_typeof(p_lignes) is distinct from 'array' then
    raise exception 'Les lignes doivent être un tableau.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lignes) > least(p_lues, 5000) then
    raise exception 'Trop de lignes pour cet import.' using errcode = '22023';
  end if;

  insert into public.imports (nom_fichier, format, lignes_lues, lignes_importees, lignes_ecartees)
  values (p_nom_fichier, p_format, p_lues, 0, p_lues)
  returning id into v_import;

  with nouvelles as (
    insert into public.transactions (date, libelle_brut, marchand, montant, categorie_id, source, empreinte, import_id)
    select (l->>'date')::date,
           l->>'libelle',
           l->>'marchand',
           (l->>'montant')::numeric(12,2),
           nullif(l->>'categorie_id', '')::uuid,
           'import',
           l->>'empreinte',
           v_import
      from jsonb_array_elements(p_lignes) as l
    on conflict (user_id, empreinte) where empreinte is not null do nothing
    returning 1
  )
  select count(*) into v_n from nouvelles;

  update public.imports
     set lignes_importees = v_n, lignes_ecartees = p_lues - v_n
   where id = v_import;

  return jsonb_build_object('import_id', v_import, 'importees', v_n, 'ecartees', p_lues - v_n);
end $$;

revoke all on function public.importer_releve(text, public.format_import, int, jsonb) from public, anon;
grant execute on function public.importer_releve(text, public.format_import, int, jsonb) to authenticated;
