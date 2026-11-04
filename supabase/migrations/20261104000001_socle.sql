-- Mes finances : schéma de base, RLS et fonctions.
-- Montants : numeric(12,2). Taux : numeric(7,4) exprimés en pourcentage (9,975 = 9,975 %).

-- ---------------------------------------------------------------- types
create type public.type_categorie as enum ('revenu', 'depense', 'epargne');
create type public.source_tx      as enum ('import', 'manuel', 'recu', 'facture');
create type public.format_import  as enum ('csv', 'pdf', 'image', 'texte');
create type public.statut_facture as enum ('brouillon', 'envoyee', 'payee');
create type public.mode_capacite  as enum ('auto', 'manuel');
create type public.type_compte    as enum ('celi', 'reer', 'celiapp', 'reee', 'non_enregistre',
                                           'epargne', 'cheques', 'crypto', 'dette', 'autre');

-- ---------------------------------------------------------------- profils
create table public.profils (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  devise               char(3)       not null default 'CAD' check (devise in ('CAD','USD','EUR','CHF','CDF')),
  mode_capacite        public.mode_capacite not null default 'auto',
  capacite_manuelle    numeric(12,2) not null default 0     check (capacite_manuelle >= 0),
  frais_carte_pct      numeric(7,4)  not null default 2.9   check (frais_carte_pct between 0 and 100),
  frais_carte_fixe     numeric(12,2) not null default 0.25  check (frais_carte_fixe >= 0),
  frais_interac        numeric(12,2) not null default 0     check (frais_interac >= 0),
  frais_change_pct     numeric(7,4)  not null default 1.5   check (frais_change_pct between 0 and 100),
  abonnement_compte_us numeric(12,2) not null default 10    check (abonnement_compte_us >= 0),
  taux_tps             numeric(7,4)  not null default 5     check (taux_tps between 0 and 100),
  taux_tvq             numeric(7,4)  not null default 9.975 check (taux_tvq between 0 and 100),
  entreprise_nom       text check (length(entreprise_nom) <= 120),
  entreprise_adresse   text check (length(entreprise_adresse) <= 300),
  no_tps               text check (length(no_tps) <= 30),
  no_tvq               text check (length(no_tvq) <= 30),
  cree_le              timestamptz   not null default now()
);

-- ---------------------------------------------------------------- catégories
-- « code » identifie les catégories dont le code dépend (frais, affaires, rev-entreprise…).
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code           text check (code ~ '^[a-z][a-z-]{1,30}$'),
  nom            text not null check (length(trim(nom)) between 1 and 60),
  type           public.type_categorie not null,
  budget_mensuel numeric(12,2) not null default 0 check (budget_mensuel >= 0),
  ordre          smallint not null default 0,
  unique (user_id, nom),
  unique (user_id, code),
  unique (id, user_id)
);

-- ---------------------------------------------------------------- imports
create table public.imports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom_fichier       text not null check (length(nom_fichier) <= 255),
  format            public.format_import not null,
  lignes_lues       int not null check (lignes_lues >= 0),
  lignes_importees  int not null check (lignes_importees >= 0),
  lignes_ecartees   int not null check (lignes_ecartees >= 0),
  cree_le           timestamptz not null default now(),
  check (lignes_importees + lignes_ecartees = lignes_lues),
  unique (id, user_id)
);

-- ---------------------------------------------------------------- projets
create table public.projets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 1 and 80),
  cout           numeric(12,2) not null check (cout > 0),
  montant_depart numeric(12,2) not null default 0 check (montant_depart >= 0),
  echeance       date not null,
  priorite       smallint not null default 2 check (priorite between 1 and 3),
  notes          text check (length(notes) <= 1000),
  cree_le        timestamptz not null default now(),
  unique (id, user_id)
);

create table public.postes_projet (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  projet_id   uuid not null,
  nom         text not null check (length(trim(nom)) between 1 and 80),
  montant     numeric(12,2) not null check (montant >= 0),
  explication text check (length(explication) <= 500),
  ordre       smallint not null default 0,
  foreign key (projet_id, user_id) references public.projets(id, user_id) on delete cascade
);
create index postes_projet_projet_idx on public.postes_projet (projet_id);

create table public.versements (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid(),
  projet_id uuid not null,
  montant   numeric(12,2) not null check (montant <> 0),   -- négatif = retrait
  date      date not null,
  note      text check (length(note) <= 200),
  foreign key (projet_id, user_id) references public.projets(id, user_id) on delete cascade
);
create index versements_projet_idx on public.versements (projet_id);

-- ---------------------------------------------------------------- factures
create table public.factures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero        text not null check (numero ~ '^F-[0-9]{4}-[0-9]{3,}$'),
  client        text not null check (length(trim(client)) between 1 and 120),
  courriel      text check (length(courriel) <= 254),
  description   text not null check (length(trim(description)) between 1 and 500),
  montant_ht    numeric(12,2) not null check (montant_ht >= 0),
  taxable       boolean not null default true,
  taux_tps      numeric(7,4) not null check (taux_tps between 0 and 100),  -- copie du profil à la création
  taux_tvq      numeric(7,4) not null check (taux_tvq between 0 and 100),
  tps           numeric(12,2) not null default 0 check (tps >= 0),
  tvq           numeric(12,2) not null default 0 check (tvq >= 0),
  date_facture  date not null default current_date,
  echeance      date,
  statut        public.statut_facture not null default 'brouillon',
  date_paiement date,
  cree_le       timestamptz not null default now(),
  check ((statut = 'payee') = (date_paiement is not null)),
  check (taxable or (tps = 0 and tvq = 0)),
  unique (user_id, numero),
  unique (id, user_id)
);

-- ---------------------------------------------------------------- transactions
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date          date not null,
  libelle_brut  text not null check (length(libelle_brut) between 1 and 300),
  marchand      text not null check (length(marchand) <= 120),
  montant       numeric(12,2) not null check (montant <> 0),   -- négatif = sortie
  categorie_id  uuid,
  source        public.source_tx not null,
  deductible    boolean not null default false,
  tps           numeric(12,2) not null default 0 check (tps >= 0),
  tvq           numeric(12,2) not null default 0 check (tvq >= 0),
  facture_id    uuid,
  import_id     uuid,
  recu_chemin   text check (length(recu_chemin) <= 300),
  empreinte     text check (empreinte ~ '^[0-9a-f]{64}$'),
  cree_le       timestamptz not null default now(),
  foreign key (categorie_id, user_id) references public.categories(id, user_id) on delete set null (categorie_id),
  foreign key (facture_id, user_id)   references public.factures(id, user_id)   on delete set null (facture_id),
  foreign key (import_id, user_id)    references public.imports(id, user_id)    on delete set null (import_id)
);
-- Un réimport du même relevé ne peut pas créer de doublon exact.
create unique index transactions_empreinte_uk on public.transactions (user_id, empreinte) where empreinte is not null;
-- Une facture payée ne crée qu'un seul revenu.
create unique index transactions_facture_uk   on public.transactions (facture_id) where facture_id is not null;
create index transactions_user_date_idx       on public.transactions (user_id, date desc);
create index transactions_categorie_idx       on public.transactions (categorie_id);
create index transactions_import_idx          on public.transactions (import_id);

-- ---------------------------------------------------------------- comptes
create table public.comptes (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom      text not null check (length(trim(nom)) between 1 and 80),
  type     public.type_compte not null,
  solde    numeric(12,2) not null check (solde >= 0),  -- une dette est saisie en positif, soustraite de l'avoir net
  maj_le   date not null default current_date
);
create index comptes_user_idx on public.comptes (user_id);

-- ---------------------------------------------------------------- journal IA
-- Lisible par l'utilisateur, écrit seulement par le serveur (clé de service) :
-- l'utilisateur ne peut pas effacer ses lignes pour remettre son compteur à zéro.
create table public.usage_ia (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  jour           date not null default current_date,
  route          text not null,
  modele         text not null,
  jetons_entree  int not null default 0,
  jetons_sortie  int not null default 0,
  succes         boolean not null,
  cree_le        timestamptz not null default now()
);
create index usage_ia_user_jour_idx on public.usage_ia (user_id, jour);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['profils','categories','imports','projets','postes_projet',
                           'versements','factures','transactions','comptes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy proprietaire on public.%I for all to authenticated
                     using ((select auth.uid()) = user_id)
                     with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;

-- Le profil est créé par le déclencheur et supprimé avec le compte.
revoke insert, delete on public.profils from authenticated;

alter table public.usage_ia enable row level security;
revoke all on public.usage_ia from anon, public, authenticated;
grant select on public.usage_ia to authenticated;
create policy lecture_seule on public.usage_ia for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- facture payée → un seul revenu
-- security invoker : la RLS s'applique, on ne peut payer que ses propres factures.
create function public.marquer_facture_payee(p_facture uuid, p_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f   public.factures;
  cat uuid;
  tx  uuid;
begin
  update public.factures
     set statut = 'payee', date_paiement = p_date
   where id = p_facture and statut <> 'payee'
  returning * into f;

  if not found then
    select id into tx from public.transactions where facture_id = p_facture;
    return tx;                         -- déjà payée (ou invisible) : aucun effet
  end if;

  select id into cat from public.categories where user_id = f.user_id and code = 'rev-entreprise';

  insert into public.transactions (user_id, date, libelle_brut, marchand, montant, categorie_id,
                                   source, facture_id, tps, tvq)
  values (f.user_id, p_date, 'Facture ' || f.numero || ' ' || f.client, f.client,
          f.montant_ht + f.tps + f.tvq, cat, 'facture', f.id, f.tps, f.tvq)
  on conflict do nothing
  returning id into tx;

  return tx;
end $$;
revoke all on function public.marquer_facture_payee(uuid, date) from public, anon;
grant execute on function public.marquer_facture_payee(uuid, date) to authenticated;

-- ---------------------------------------------------------------- inscription
create function public.initialiser_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (user_id) values (new.id);
  insert into public.categories (user_id, code, nom, type, budget_mensuel, ordre)
  select new.id, c.code, c.nom, c.type::public.type_categorie, c.budget, c.ordre
  from (values
    ('salaire',         'Salaire et prestations',     'revenu',  0,    1),
    ('rev-entreprise',  'Revenus d''entreprise',      'revenu',  0,    2),
    ('autres-revenus',  'Autres revenus',             'revenu',  0,    3),
    ('logement',        'Logement (loyer, Hydro)',    'depense', 1150, 4),
    ('epicerie',        'Épicerie',                   'depense', 380,  5),
    ('restaurants',     'Restaurants',                'depense', 90,   6),
    ('transport',       'Transport',                  'depense', 110,  7),
    ('telecom',         'Cellulaire et Internet',     'depense', 95,   8),
    ('abonnements',     'Abonnements',                'depense', 35,   9),
    ('sante',           'Santé et pharmacie',         'depense', 40,   10),
    ('achats',          'Achats',                     'depense', 100,  11),
    ('loisirs',         'Loisirs',                    'depense', 60,   12),
    ('education',       'Éducation',                  'depense', 0,    13),
    ('famille',         'Envois à la famille',        'depense', 150,  14),
    ('frais',           'Frais bancaires',            'depense', 0,    15),
    ('affaires',        'Dépenses d''entreprise',     'depense', 0,    16),
    ('autres',          'Autres dépenses',            'depense', 50,   17),
    ('epargne',         'Épargne et projets',         'epargne', 0,    18)
  ) as c(code, nom, type, budget, ordre);
  return new;
end $$;
revoke all on function public.initialiser_utilisateur() from public, anon, authenticated;

create trigger apres_inscription
  after insert on auth.users
  for each row execute function public.initialiser_utilisateur();
