# Mes finances : plan, schéma SQL et structure (v1, validé le 2026-11-04)

> Le schéma appliqué fait foi : `supabase/migrations/`. La section 4 ci-dessous est la proposition d'origine.

## 0. Règles lues dans le prototype (à reproduire telles quelles)

Ces détails ne figurent pas dans le cahier des charges ; ils déterminent pourtant la parité exigée.

| Règle | Comportement du prototype |
|---|---|
| Capacité auto | Mois *antérieurs* au mois courant ayant des transactions, les 3 derniers (pas forcément consécutifs). Résultat **plancher à 0**. Transaction sans catégorie : revenu si montant ≥ 0, sinon dépense. |
| Mois restants | Différence de mois calendaires (année×12 + mois), les jours sont ignorés. Diviseur = max(1, mois). |
| Statut « dans les temps » | Alloué ≥ requis − **0,50 $** (tolérance). Échéance dépassée : prioritaire sur tout autre statut. |
| Projet échu | Mois ≤ 0 ⇒ diviseur 1 ⇒ il réclame **tout son reste** sur le mois courant et consomme la capacité. |
| Mois d'atteinte projeté | k = ⌈reste ÷ alloué⌉ ; affiché « vers <mois> <année> » pour un projet sous-financé seulement. |
| Écart mensuel | Capacité − somme des efforts requis (tous projets non atteints). |
| Projet le plus à risque | Ordre : échu, non financé, sous-financé, dans les temps, atteint ; puis échéance. Si aucun n'est à risque : « Prochaine échéance ». |
| Radar à frais | 12 mois incluant le mois courant. Frais = catégorie « Frais bancaires » **ou** libellé qui correspond au motif de frais. 4 types : change, intérêts, provision insuffisante, « frais de compte et autres ». |
| Paiements récurrents | Exclut logement, épicerie, frais. Même marchand dans ≥ 2 mois, toutes les valeurs à ≤ max(0,50 $ ; 5 %) de la moyenne, **et au plus (mois + 1) occurrences**. Coût annuel = moyenne × 12. |
| Doublon exact | Clé = date + montant + mots du libellé (> 2 lettres, sans nombres). Vaut aussi **à l'intérieur du même fichier**. |
| Dates CSV ambiguës | JJ/MM seulement si un premier nombre > 12 apparaît dans la colonne ; sinon MM/JJ. |
| Facture payée | Revenu = total TTC, catégorie « Revenus d'entreprise ». |
| Change | Coût aller = montant × taux ; aller-retour = × 2 ; compte US rentable au-delà de abonnement ÷ taux convertis par mois. |
| Croissance | Capitalisation mensuelle, versement en fin de mois, frais soustraits du rendement. |

**Oracle de parité** : le prototype expose `window.__fin` (calcProjets, radar, parseCSV, marquerDoublons…). Les tests de parité exécutent le prototype dans Playwright avec une date figée et comparent ses résultats à ceux de `src/domaine/`.

**Écarts volontaires** (corrigent des défauts du prototype) :
1. Taux de TPS/TVQ **copiés dans la facture** à sa création. Le prototype recalcule les anciennes factures avec les taux actuels : changer un taux modifierait rétroactivement l'état des résultats.
2. Date de paiement choisie par l'utilisateur (aujourd'hui par défaut) ; le prototype impose aujourd'hui.
3. Numéro F-AAAA-NNN avec 3 chiffres **ou plus** (pas de plafond à 999).

**Ajouts au schéma** par rapport à la proposition : `categories.code` (le code dépend des catégories « frais », « affaires », « rev-entreprise »…), format d'import `texte` (texte collé, présent dans le prototype), solde de compte ≥ 0 (dette saisie en positif).

## 1. Constats vérifiés dans l'environnement (2026-11-04)

| Élément | Version stable actuelle | Décision |
|---|---|---|
| next / eslint-config-next | 16.4.5 | Next 16, App Router |
| react / react-dom | 19.3.1 | |
| typescript | 7.0.2 (latest) | **Épingler 5.9.3** : typescript-eslint exige `typescript <6.1.0`. TS 7 casserait `npm run lint`. |
| @supabase/supabase-js / @supabase/ssr | 2.119.0 / 0.12.7 | |
| supabase (CLI) | 3.0.0 | migrations + génération des types |
| tailwindcss | 4.3.4 | configuration CSS (v4) |
| zod | 4.6.7 | carte d'erreurs en français (les messages par défaut sont en anglais) |
| @anthropic-ai/sdk | 1.5.0 | serveur seulement (`import "server-only"`) |
| pdfjs-dist | 6.5.438 | extraction côté appareil |
| vitest / @playwright/test | 5.1.0 / 1.64.1 | Node 22.23 présent, compatible |
| serwist / @serwist/next | 9.5.13 | service worker PWA |

Conteneur : Postgres 16 disponible localement, démon Docker arrêté, aucun dépôt git.

## 2. Décisions de conception (avec justification)

1. **Montants** : `numeric(12,2)` en base ; **cents entiers** (`number`, sûr jusqu'à 9×10¹⁵) dans le code TypeScript. Conversion uniquement aux frontières (lecture/écriture DB, saisie, affichage). Aucun calcul en virgule flottante sur des dollars. Affichage `Intl.NumberFormat('fr-CA', {style:'currency', currency:'CAD'})` → « 1 234,56 $ ».
2. **Règles métier = fonctions pures** dans `src/domaine/`, sans accès réseau ni base. Un fichier de test par règle. Le serveur, le client et l'assistant IA appellent les mêmes fonctions. Le modèle ne calcule jamais.
3. **Anti-doublon garanti par la base**, pas seulement par l'écran : `unique (user_id, empreinte)`. Empreinte = SHA-256 de `date | montant en cents | libellé normalisé | rang d'occurrence dans le fichier`. Le rang distingue deux cafés identiques le même jour dans un même relevé, et un réimport du même fichier produit les mêmes empreintes → rejet à l'insertion (`on conflict do nothing`). Le doublon *probable* (Jaccard ≥ 0,4, ±3 jours) reste une décision de l'utilisateur à l'écran de revue.
4. **Facture payée → une seule transaction** : fonction SQL `marquer_facture_payee()` exécutée en une transaction + index unique partiel sur `transactions(facture_id)`. Deux clics ou deux onglets ne peuvent pas créer deux revenus.
5. **Taxes figées sur la facture** : taux de TPS/TVQ copiés dans la facture à sa création. Changer les taux du profil ne réécrit pas les factures passées, et l'état des résultats reste juste.
6. **Intégrité propriétaire** : chaque table enfant porte `user_id` et une clé étrangère composite `(parent_id, user_id)`. Impossible de rattacher un versement au projet d'un autre utilisateur, même avec un identifiant deviné.
7. **Limite IA non contournable** : la table `usage_ia` est lisible par l'utilisateur, mais seul le serveur (clé de service) y écrit. Sinon l'utilisateur pourrait supprimer ses lignes pour remettre son compteur à zéro.
8. **Scénarios** : aucune table. La copie vit en mémoire côté client ; « Appliquer » envoie un seul lot de mises à jour validé par Zod.
9. **Aucun texte anglais** : tous les textes dans `src/textes/fr-CA.ts` ; pages `not-found`, `error`, `global-error` personnalisées ; validation de formulaires par Zod (pas les bulles natives du navigateur, qui suivent la langue du navigateur) ; `lang="fr-CA"` ; un test Playwright parcourt chaque écran et échoue sur une liste de mots anglais courants.
10. **Tests RLS** sur un vrai Postgres (local, version 16) avec un schéma `auth` minimal qui reproduit `auth.uid()` (même mécanisme que Supabase : `request.jwt.claims`). Deux utilisateurs, chaque table, chaque opération (lecture, insertion, modification, suppression). Les mêmes tests peuvent ensuite tourner contre le projet Supabase réel.

## 3. Plan par phases

Chaque phase se termine par : tests unitaires des règles touchées, un test Playwright du parcours principal, `npm run build` et `npm run lint` sans erreur, commit, résumé en 5 lignes.

| Phase | Contenu | Preuve de fin |
|---|---|---|
| **0. Préparation** | Récupérer le prototype, extraire ses règles en cas de test chiffrés (entrées → sorties attendues), `CLAUDE.md`, `.env.example`, squelette Next/Tailwind/Vitest/Playwright | Les cas du prototype existent sous forme de fichiers de données de test |
| **1. Socle** | Auth courriel + lien magique, migration complète, RLS, déclencheur de création du profil et des catégories par défaut **[PROTO]**, navigation basse, thème clair/sombre | Test RLS : l'utilisateur B ne lit, ne modifie, ne supprime aucune ligne de A, sur chaque table, et ne peut pas insérer avec le `user_id` de A |
| **2. Budget** | Transactions, catégories, import CSV (détection séparateur/en-tête/colonnes, 3 formats de date, 3 formats de montant), écran de revue, doublons, radar à frais, paiements récurrents, capacité d'épargne | 7 fichiers CSV fictifs (Desjardins, BN, RBC, TD, BMO, Scotia, Tangerine) importés correctement ; double import = 0 nouvelle ligne |
| **3. Projets** | Horizon, effort requis, répartition, statuts, date d'atteinte projetée, versements, postes, scénarios, graphique de l'épargne cumulée, **écran d'accueil fixe** | Cas « 3 projets, capacité insuffisante » : manque mensuel et statuts identiques au prototype |
| **4. Affaires** | Factures F-AAAA-NNN, taxes, frais carte vs Interac affichés avant l'envoi, paiement → revenu unique, reçus (photo dans Storage), état des résultats annuel avec mention « estimation à faire valider par un comptable » | Marquer payée deux fois → 1 transaction |
| **5. Placements** | Comptes, avoir net, comparaison des comptes selon l'horizon, simulateur de croissance avec coût des frais, calculateur de change, mention « information générale » visible | Valeurs du simulateur égales aux formules de référence |
| **6. Classement sans IA** (remplace la phase IA, décision du 2026-11-05 : pas de budget d'API) | Règles par mots-clés modifiables (écran « Règles de classement ») ; une règle retenue à chaque correction de catégorie, avec proposition de classer les transactions semblables ; règles appliquées à l'import ; code IA conservé mais éteint : réglage par utilisateur (éteint par défaut), route serveur qui refuse sans clé (503) avant tout appel, limite quotidienne, journal des jetons, réponse validée par Zod. **Reportés** : lecture des PDF et des images, lecture des reçus, estimation de projet, assistant | Correction → règle retenue → nouvel import classé ; sans clé : `/api/ia/*` répond 503 et le réglage est grisé |
| **7. Livraison** | PWA (installable, hors ligne en lecture), export JSON + CSV, suppression du compte (base + fichiers Storage), politique de confidentialité, déploiement Vercel. **Courriels** : configurer un SMTP personnalisé (choix du fournisseur et coût à valider), puis traduire les modèles « Confirm sign up » et « Magic link or OTP » en y ajoutant `{{ .Token }}`, la saisie du code est déjà en place dans l'écran de connexion (indispensable sur iPhone : Gmail ouvre le lien dans son propre navigateur, et l'application installée ne reçoit pas la session d'un lien ouvert dans Safari) | Accueil affiché hors ligne après une visite ; compte supprimé → 0 ligne restante pour ce `user_id` ; courriels de connexion en français |

## 4. Schéma SQL (migration `0001_socle.sql`)

```sql
-- Types
create type type_categorie   as enum ('revenu', 'depense', 'epargne');
create type source_tx        as enum ('import', 'manuel', 'recu', 'facture');
create type format_import    as enum ('csv', 'pdf', 'image');
create type statut_facture   as enum ('brouillon', 'envoyee', 'payee');
create type mode_capacite    as enum ('auto', 'manuel');
create type type_compte      as enum ('celi', 'reer', 'celiapp', 'reee', 'non_enregistre',
                                      'epargne', 'cheques', 'crypto', 'dette', 'autre');

-- Profil (1 ligne par utilisateur, créée par déclencheur)
create table public.profils (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  devise               char(3)        not null default 'CAD',
  mode_capacite        mode_capacite  not null default 'auto',
  capacite_manuelle    numeric(12,2)  not null default 0     check (capacite_manuelle >= 0),
  frais_carte_pct      numeric(7,4)   not null default 2.9   check (frais_carte_pct between 0 and 100),
  frais_carte_fixe     numeric(12,2)  not null default 0.25  check (frais_carte_fixe >= 0),
  frais_interac        numeric(12,2)  not null default 0     check (frais_interac >= 0),      -- [PROTO]
  frais_change_pct     numeric(7,4)   not null default 2.5   check (frais_change_pct between 0 and 100), -- [PROTO]
  abonnement_compte_us numeric(12,2)  not null default 0     check (abonnement_compte_us >= 0),
  taux_tps             numeric(7,4)   not null default 5     check (taux_tps between 0 and 100),
  taux_tvq             numeric(7,4)   not null default 9.975 check (taux_tvq between 0 and 100),
  entreprise_nom       text,
  entreprise_adresse   text,
  no_tps               text,
  no_tvq               text,
  cree_le              timestamptz not null default now(),
  modifie_le           timestamptz not null default now()
);

create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 1 and 60),
  type           type_categorie not null,
  budget_mensuel numeric(12,2) check (budget_mensuel >= 0),
  ordre          smallint not null default 0,
  unique (user_id, nom),
  unique (id, user_id)
);

create table public.imports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom_fichier       text not null,
  format            format_import not null,
  lignes_lues       int not null check (lignes_lues >= 0),
  lignes_importees  int not null check (lignes_importees >= 0),
  lignes_ecartees   int not null check (lignes_ecartees >= 0),
  cree_le           timestamptz not null default now(),
  check (lignes_importees + lignes_ecartees = lignes_lues),
  unique (id, user_id)
);

create table public.projets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 1 and 80),
  cout           numeric(12,2) not null check (cout > 0),
  montant_depart numeric(12,2) not null default 0 check (montant_depart >= 0),
  echeance       date not null,
  priorite       smallint not null check (priorite between 1 and 3),
  notes          text,
  cree_le        timestamptz not null default now(),
  unique (id, user_id)
);

create table public.postes_projet (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  projet_id   uuid not null,
  nom         text not null,
  montant     numeric(12,2) not null check (montant >= 0),
  explication text,
  foreign key (projet_id, user_id) references public.projets(id, user_id) on delete cascade
);

create table public.versements (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid(),
  projet_id uuid not null,
  montant   numeric(12,2) not null check (montant <> 0),   -- négatif = retrait
  date      date not null,
  note      text,
  foreign key (projet_id, user_id) references public.projets(id, user_id) on delete cascade
);

create table public.factures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero        text not null check (numero ~ '^F-[0-9]{4}-[0-9]{3}$'),
  client        text not null,
  courriel      text,
  description   text,
  montant_ht    numeric(12,2) not null check (montant_ht >= 0),
  taxable       boolean not null default true,
  taux_tps      numeric(7,4) not null,     -- copie du profil à la création
  taux_tvq      numeric(7,4) not null,
  tps           numeric(12,2) not null default 0,
  tvq           numeric(12,2) not null default 0,
  date_facture  date not null default current_date,
  echeance      date,
  statut        statut_facture not null default 'brouillon',
  date_paiement date,
  check ((statut = 'payee') = (date_paiement is not null)),
  unique (user_id, numero),
  unique (id, user_id)
);

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date          date not null,
  libelle_brut  text not null,
  marchand      text not null,               -- libellé normalisé
  montant       numeric(12,2) not null check (montant <> 0),  -- négatif = sortie
  categorie_id  uuid,
  source        source_tx not null,
  deductible    boolean not null default false,
  tps           numeric(12,2) not null default 0,
  tvq           numeric(12,2) not null default 0,
  facture_id    uuid,
  import_id     uuid,
  recu_chemin   text,                        -- chemin dans le bucket « recus »
  empreinte     text,                        -- nulle pour une saisie manuelle
  cree_le       timestamptz not null default now(),
  foreign key (categorie_id, user_id) references public.categories(id, user_id) on delete set null (categorie_id),
  foreign key (facture_id, user_id)   references public.factures(id, user_id)   on delete set null (facture_id),
  foreign key (import_id, user_id)    references public.imports(id, user_id)    on delete set null (import_id),
  check ((source = 'facture') = (facture_id is not null))
);
create unique index transactions_empreinte_uk on public.transactions (user_id, empreinte) where empreinte is not null;
create unique index transactions_facture_uk   on public.transactions (facture_id)        where facture_id is not null;
create index transactions_user_date_idx       on public.transactions (user_id, date desc);

create table public.comptes (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom      text not null,
  type     type_compte not null,
  solde    numeric(12,2) not null,            -- une dette est saisie en positif et soustraite de l'avoir net
  maj_le   date not null default current_date
);

-- Journal IA : lecture par l'utilisateur, écriture par le serveur seulement
create table public.usage_ia (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  jour           date not null default current_date,
  route          text not null,
  modele         text not null,
  jetons_entree  int not null,
  jetons_sortie  int not null,
  succes         boolean not null,
  cree_le        timestamptz not null default now()
);
create index usage_ia_user_jour_idx on public.usage_ia (user_id, jour);

-- RLS : même politique sur chaque table métier
do $$
declare t text;
begin
  foreach t in array array['profils','categories','imports','projets','postes_projet',
                           'versements','factures','transactions','comptes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy proprietaire on public.%I for all to authenticated
                     using ((select auth.uid()) = user_id)
                     with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
alter table public.usage_ia enable row level security;
create policy lecture_seule on public.usage_ia for select to authenticated
  using ((select auth.uid()) = user_id);

-- Facture payée → un seul revenu (RLS appliquée : security invoker)
create function public.marquer_facture_payee(p_facture uuid, p_date date)
returns void language plpgsql security invoker set search_path = '' as $$
declare f public.factures;
begin
  update public.factures set statut = 'payee', date_paiement = p_date
   where id = p_facture and statut <> 'payee'
  returning * into f;
  if not found then return; end if;            -- déjà payée ou invisible : aucun effet
  insert into public.transactions (user_id, date, libelle_brut, marchand, montant,
                                   source, facture_id, tps, tvq)
  values (f.user_id, p_date, 'Facture ' || f.numero, f.client,
          f.montant_ht + f.tps + f.tvq, 'facture', f.id, f.tps, f.tvq)
  on conflict do nothing;
end $$;

-- Création du profil et des catégories par défaut à l'inscription
create function public.initialiser_utilisateur() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (user_id) values (new.id);
  insert into public.categories (user_id, nom, type, ordre)
  select new.id, c.nom, c.type::public.type_categorie, c.ordre
  from (values ('Salaire','revenu',1), ('Épicerie','depense',2) /* [PROTO] liste complète */)
       as c(nom, type, ordre);
  return new;
end $$;
create trigger apres_inscription after insert on auth.users
  for each row execute function public.initialiser_utilisateur();

-- Storage : bucket privé « recus », un dossier par utilisateur
-- chemin = <user_id>/<uuid>.jpg ; politique : (storage.foldername(name))[1] = auth.uid()::text
```

Points ouverts du schéma :
- **Numérotation F-AAAA-NNN** : 999 factures par an au maximum. Suffisant pour un travailleur autonome ; à confirmer.
- **Prochain numéro** : calculé côté serveur (`max + 1` de l'année) et protégé par `unique (user_id, numero)` avec une nouvelle tentative en cas de conflit.
- **Revenu d'une facture** : la transaction reçoit le montant toutes taxes comprises, TPS et TVQ ventilées ; l'état des résultats utilise le montant avant taxes. **[PROTO]** à confirmer.

## 5. Structure des dossiers

```
mes-finances/
├── CLAUDE.md                 conventions (langue, montants, tests, commandes)
├── .env.example              variables, sans valeurs
├── prototype/index.html      référence (lecture seule)
├── supabase/
│   ├── migrations/           0001_socle.sql, puis une migration par changement
│   └── seed.sql              données fictives de démonstration
├── src/
│   ├── app/
│   │   ├── (public)/connexion/, confidentialite/
│   │   ├── (app)/            layout avec navigation basse (5 onglets)
│   │   │   ├── accueil/      écran fixe
│   │   │   ├── budget/       transactions, categories, import (revue), radar
│   │   │   ├── projets/      liste, [id], scenario
│   │   │   ├── affaires/     factures, recus, resultats
│   │   │   ├── placements/   comptes, simulateurs
│   │   │   ├── assistant/
│   │   │   └── reglages/     profil, export, suppression
│   │   ├── api/ia/{extraction,categorisation,recu,estimation,assistant}/route.ts
│   │   ├── api/compte/{export,suppression}/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── not-found.tsx, error.tsx, global-error.tsx   (en français)
│   │   ├── manifest.ts
│   │   └── sw.ts             service worker (Serwist)
│   ├── domaine/              fonctions pures, testées à 100 %
│   │   ├── argent.ts         cents, arrondi, format fr-CA
│   │   ├── dates.ts          mois complets, mois restants
│   │   ├── capacite.ts
│   │   ├── projets.ts        horizon, effort, répartition, statut, projection
│   │   ├── scenario.ts
│   │   ├── normalisation.ts  libellé → marchand
│   │   ├── doublons.ts       empreinte, exact, probable (Jaccard)
│   │   ├── radar.ts, recurrents.ts
│   │   ├── factures.ts       numéro, taxes, frais carte vs Interac
│   │   ├── resultats.ts      état des résultats, taxes nettes
│   │   └── placements.ts     croissance, coût des frais, change, comparaison
│   ├── import/
│   │   ├── csv/              separateur.ts, entete.ts, colonnes.ts, dates.ts, montants.ts
│   │   ├── pdf.ts            pdf.js, détection « sans texte »
│   │   └── source-bancaire.ts   interface SourceBancaire (non implémentée)
│   ├── ia/                   serveur seulement
│   │   ├── client.ts, schemas.ts, limite.ts, journal.ts, outils-assistant.ts, consignes/
│   ├── donnees/              clients Supabase (serveur, navigateur), requêtes, types générés
│   ├── ui/                   composants accessibles
│   └── textes/fr-CA.ts       tous les textes de l'interface
└── tests/
    ├── unitaires/            miroir de src/domaine et src/import
    ├── rls/                  isolation entre deux utilisateurs
    ├── e2e/                  Playwright, viewport téléphone
    └── fixtures/releves/     desjardins.csv, banque-nationale.csv, rbc.csv, td.csv,
                              bmo.csv, scotia.csv, tangerine.csv (fictifs)
```

## 6. État à la livraison (phase 7, 2026-11-05) et passage au public

**Usage personnel (aujourd'hui)** : Supabase gratuit (ca-central-1), envoi de courriels intégré de Supabase (modèles en anglais, lien à ouvrir dans le même navigateur), Vercel Hobby, IA éteinte, responsable de la protection des renseignements personnels : Jonathan Mboko.

**Production** : https://mes-finances-phi.vercel.app (projet Vercel `mes-finances`, relié à `Mamba982/Mes-finances-` : chaque poussée sur `main` redéploie ; fonctions en `iad1`). Variables : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publiques) ; `SUPABASE_SECRET_KEY` à saisir dans Vercel par le propriétaire (type « Sensitive »), sans quoi la suppression du compte répond « indisponible ». Supabase : Site URL = l'adresse de production, Redirect URLs = `https://mes-finances-phi.vercel.app/auth/confirmer` (plus `http://localhost:3000/auth/confirmer` pour le développement).

**Mesures** : accueil à la visite suivante en 4G lente simulée (150 ms, 1,6 Mb/s) : environ 190 ms (copie locale + service worker). Première visite sans cache, du lien de connexion à l'accueil rempli : environ 3,1 s dans les mêmes conditions. L'objectif « moins d'une seconde » est donc atteint pour les visites suivantes seulement.

### Ce qui changera au passage au public

| # | Changement | Pourquoi | Coût ou effort |
|---|---|---|---|
| 1 | **SMTP Brevo** : créer le compte, vérifier l'expéditeur (domaine), remplir `SMTP_*`, `SUPABASE_ACCESS_TOKEN`, puis `node --env-file=.env.local scripts/configurer-courriels.mjs` | L'envoi intégré de Supabase est limité (débit très bas, destinataires restreints) ; il applique aussi les modèles français de `supabase/modeles/` | Brevo gratuit : environ 300 courriels/jour |
| 2 | **Code de connexion dans le courriel** : l'écran de connexion a déjà le champ (fait le 2026-11-05) ; il ne sert qu'une fois les modèles avec `{{ .Token }}` appliqués (point 1). Longueur du code : 8 chiffres dans ce projet (réglage Supabase « Email OTP Length », 6 à 10) ; l'écran accepte 6 à 10 | Sur iPhone, Gmail ouvre le lien dans son propre navigateur ; l'application installée ne reçoit pas la session d'un lien ouvert dans Safari | Fait côté application |
| 3 | **Lien du courriel vers `/auth/confirmer?token_hash=…`** (déjà dans les modèles) | Le lien fonctionnera dans n'importe quel navigateur, plus seulement celui qui l'a demandé | Inclus dans 1 |
| 4 | **Supabase Pro** | Le gratuit met le projet en pause après 7 jours sans activité et n'offre pas de sauvegardes adaptées à des données financières | Environ 25 $ US/mois |
| 5 | **Vercel Pro** si l'usage devient commercial | Vercel Hobby est réservé à l'usage personnel non commercial | Environ 20 $ US/mois |
| 6 | **Nom de domaine** ; Site URL et Redirect URLs de Supabase ; domaine Vercel | Adresse stable pour les liens de connexion et l'installation | Environ 20 $/an |
| 7 | **Région des fonctions serveur** : vérifier si Vercel offre une région au Canada ; sinon, garder `iad1` et le dire dans la politique | Loi 25 : informer de la communication hors Québec | Vérification |
| 8 | **Protection de l'inscription** (CAPTCHA Turnstile ou hCaptcha dans Supabase Auth) et limites de débit | Éviter les comptes automatisés et l'abus d'envoi de courriels | Gratuit |
| 9 | **En-tête Content-Security-Policy** et revue des avis de sécurité Supabase | Défense en profondeur | Petit |
| 10 | **Loi 25** : registre des incidents de confidentialité, procédure de réponse aux demandes (30 jours), règle de conservation des comptes inactifs, mise à jour de la date et retrait de la mention « avant ouverture au public » dans la politique | Obligations de l'entreprise | Rédaction |
| 11 | **Conditions d'utilisation** (information générale, aucune garde d'argent, aucun conseil personnalisé) | Encadrer l'usage public | Rédaction |
| 12 | **IA** (si budget) : `ANTHROPIC_API_KEY`, modèles, plafond de dépense dans la console Anthropic, **évaluation des facteurs relatifs à la vie privée (EFVP)** avant d'activer, puis test réel du classement | Communication hors Québec ; code jamais exercé contre la vraie API | Selon l'usage |
| 13 | **Suivi des erreurs** (journal des fonctions Vercel, éventuellement un service d'erreurs) | Fiabilité avant tout : voir les plantages avant les utilisateurs | Gratuit à petit volume |
| 14 | **Essais sur vrais appareils** : iPhone (Safari, installation, hors ligne) et Android (Chrome) | La PWA se comporte différemment selon le système | Manuel |
| 15 | **Première visite plus rapide** si mesurée trop lente en vrai 4G : réduire le JavaScript de l'accueil, précharger les données | Objectif « moins d'une seconde » à la première visite | Moyen |
| 16 | **Boutiques (plus tard)** : emballage natif (Capacitor) | Présence dans l'App Store et Google Play | Moyen |
