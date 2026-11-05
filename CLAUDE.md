# Mes finances : conventions du projet

@AGENTS.md

Application téléphonique (PWA) de finances personnelles pour le Québec et le Canada. Référence fonctionnelle : `prototype/index.html` (lecture seule). Plan et schéma : `PLAN.md`.

## Langue
- Toute l'interface est en **français canadien**. Aucun mot anglais visible, y compris messages d'erreur, titres d'onglet, pages 404/erreur, validations.
- Tous les textes vivent dans `src/textes/fr-CA.ts`. Pas de texte en dur dans les composants, sauf contenu long d'une page (ex. confidentialité).
- Tutoiement, phrases courtes, comme le prototype. « Courriel », pas « e-mail ». Pas de « ce n'est pas X, c'est Y ».
- Formulaires : `noValidate` + Zod avec messages français (les bulles natives suivent la langue du navigateur).
- Noms de code (fichiers, fonctions, colonnes) en français sans accents ; termes techniques de framework inchangés.

## Montants
- Base : `numeric(12,2)`. Code : **cents entiers** (`Cents` dans `src/domaine/argent.ts`). Jamais `parseFloat` sur un montant.
- Lecture DB : `decimalVersCents()` ; écriture : `centsVersDecimal()` ; saisie et relevés : `lireMontant()`.
- Valeurs dérivées (effort mensuel, moyennes) : cents fractionnaires permis, arrondi seulement à l'affichage ou à l'enregistrement.
- Affichage : `formaterMontant(c, 0|2)` → « 1 234 $ », « 1 234,56 $ ». Sorties négatives : montant négatif.
- Taux en pourcentage (`9.975` = 9,975 %).

## Architecture
- Pages statiques + données lues dans le navigateur par `supabase-js`. **La RLS est la frontière de sécurité**, pas la garde de session.
- Règles métier = fonctions pures dans `src/domaine/` (aucun accès réseau, aucune date système implicite : la date du jour est un paramètre).
- Classement des transactions : règles de l'utilisateur (`src/domaine/regles.ts`) puis règles par défaut du prototype. Pas de dépendance à l'IA.
- IA facultative et éteinte : sans `ANTHROPIC_API_KEY`, `/api/ia/*` répond 503 avant toute requête externe. L'utilisateur doit aussi l'activer dans les réglages (Loi 25).
- Le modèle d'IA ne calcule jamais : il extrait ou classe ; les calculs sont dans `src/domaine/`. Toute réponse IA passe par un schéma Zod ; invalide → message d'erreur, rien n'est enregistré.
- Clés secrètes (Anthropic, Supabase secrète) : serveur seulement (`import "server-only"`), jamais `NEXT_PUBLIC_`.
- Next 16 : lire `node_modules/next/dist/docs/` avant d'utiliser une API (voir AGENTS.md).

## Base de données
- Chaque table a `user_id` + politique RLS `(select auth.uid()) = user_id`. Tables enfants : clé étrangère composite `(parent_id, user_id)`.
- Un changement de schéma = une nouvelle migration dans `supabase/migrations/` (jamais modifier une migration appliquée) + test dans `tests/rls/`.

## Tests
- Chaque règle métier a un test unitaire dans `tests/unitaires/` (miroir de `src/domaine/`).
- Parité avec le prototype : les cas chiffrés sont comparés aux résultats du prototype lui-même (`window.__fin`), date du jour figée.
- Fin de chaque phase : `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint` sans erreur, puis commit.
- Parcours connectés : utilisateur créé par la clé secrète (`SUPABASE_SECRET_KEY`), session ouverte par `/auth/confirmer?token_hash=…`, utilisateur supprimé à la fin.
- Un test e2e qui ne peut pas tourner (clé ou réseau absents) est sauté avec une raison explicite, jamais simulé en silence.

## Commandes
```bash
npm run dev                          # serveur de développement
eval "$(bash scripts/db-test.sh)"    # Postgres local pour les tests RLS (exporte DATABASE_URL_TEST)
npm test                             # unitaires + RLS
npm run test:e2e                     # Playwright : e2e + parité prototype (faire npm run build avant)
NODE_USE_ENV_PROXY=1 npm run test:e2e  # dans le conteneur infonuagique (fetch de Node via le mandataire)
npm run build && npm run lint
npx tsc --noEmit
```

## Versions épinglées
TypeScript 5.9.3 (typescript-eslint n'accepte pas TS 7). Vérifier `npm view <paquet> version` avant toute mise à jour.
