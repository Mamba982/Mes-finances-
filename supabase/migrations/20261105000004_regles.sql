-- Règles de classement par mots-clés, propres à chaque utilisateur.
-- « origine » : 'manuel' (ajoutée dans l'écran des règles) ou 'auto' (retenue après une correction).
create table public.regles_categorie (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  motif        text not null check (motif ~ '^[a-z0-9]+( [a-z0-9]+)*$' and length(motif) between 2 and 80),
  categorie_id uuid not null,
  origine      text not null default 'manuel' check (origine in ('manuel', 'auto')),
  cree_le      timestamptz not null default now(),
  unique (user_id, motif),
  foreign key (categorie_id, user_id) references public.categories(id, user_id) on delete cascade,
  foreign key (user_id) references auth.users(id) on delete cascade
);
create index regles_categorie_categorie_idx on public.regles_categorie (categorie_id);

alter table public.regles_categorie enable row level security;
revoke all on public.regles_categorie from anon, public;
grant select, insert, update, delete on public.regles_categorie to authenticated;
create policy proprietaire on public.regles_categorie for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Réglage de l'IA : éteinte par défaut ; l'utilisateur l'active lui-même (Loi 25 : traitement hors Québec).
alter table public.profils add column ia_active boolean not null default false;

-- Classer plusieurs transactions en une seule opération (application des règles aux transactions à classer).
create function public.classer_transactions(p_lignes jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) > 5000 then
    raise exception 'Lignes invalides.' using errcode = '22023';
  end if;
  update public.transactions t
     set categorie_id = (l->>'categorie_id')::uuid
    from jsonb_array_elements(p_lignes) as l
   where t.id = (l->>'id')::uuid;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.classer_transactions(jsonb) from public, anon;
grant execute on function public.classer_transactions(jsonb) to authenticated;
