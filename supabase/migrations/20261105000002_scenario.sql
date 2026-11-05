-- « Appliquer » un scénario : nouvelles échéances et nouveaux coûts des projets, et capacité
-- d'épargne entrée à la main si l'épargne mensuelle change. Tout ou rien.
create function public.appliquer_scenario(p_projets jsonb, p_capacite numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l jsonb;
  n int;
begin
  if jsonb_typeof(p_projets) is distinct from 'array' then
    raise exception 'Les projets doivent être un tableau.' using errcode = '22023';
  end if;

  for l in select * from jsonb_array_elements(p_projets) loop
    update public.projets
       set echeance = (l->>'echeance')::date,
           cout = (l->>'cout')::numeric(12,2)
     where id = (l->>'id')::uuid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Projet introuvable.' using errcode = 'P0002';
    end if;
  end loop;

  if p_capacite is not null then
    update public.profils
       set mode_capacite = 'manuel', capacite_manuelle = p_capacite
     where user_id = (select auth.uid());
  end if;
end $$;

revoke all on function public.appliquer_scenario(jsonb, numeric) from public, anon;
grant execute on function public.appliquer_scenario(jsonb, numeric) to authenticated;
