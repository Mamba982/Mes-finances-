import type { Cents } from "./argent";
import { moisDe, type DateISO, type Mois } from "./dates";

export type TypeCategorie = "revenu" | "depense" | "epargne";

export interface Categorie {
  id: string;
  code: string | null;
  nom: string;
  type: TypeCategorie;
  budget: Cents;
}

export interface Transaction {
  id: string;
  date: DateISO;
  libelle: string;
  marchand: string;
  montant: Cents; // négatif = sortie
  categorieId: string | null;
  deductible: boolean;
  tps: Cents;
  tvq: Cents;
}

export type IndexCategories = ReadonlyMap<string, Categorie>;

export function indexer(categories: readonly Categorie[]): IndexCategories {
  return new Map(categories.map((c) => [c.id, c]));
}

/** Sans catégorie : entrée = revenu, sortie = dépense (règle du prototype). */
export function typeDe(t: Pick<Transaction, "categorieId" | "montant">, cats: IndexCategories): TypeCategorie {
  const c = t.categorieId ? cats.get(t.categorieId) : undefined;
  if (c) return c.type;
  return t.montant >= 0 ? "revenu" : "depense";
}

export function codeDe(t: Pick<Transaction, "categorieId">, cats: IndexCategories): string | null {
  return (t.categorieId && cats.get(t.categorieId)?.code) || null;
}

export const SANS_CATEGORIE = "_";

export interface Bilan {
  revenus: Cents;
  depenses: Cents;
  epargne: Cents;
  solde: Cents; // revenus − dépenses (l'épargne n'y entre pas)
  parCategorie: Map<string, Cents>; // dépenses, clé = id de catégorie ou SANS_CATEGORIE
}

export function bilan(txs: readonly Transaction[], ym: Mois, cats: IndexCategories): Bilan {
  let revenus = 0;
  let depenses = 0;
  let epargne = 0;
  const parCategorie = new Map<string, Cents>();
  for (const t of txs) {
    if (moisDe(t.date) !== ym) continue;
    const ty = typeDe(t, cats);
    if (ty === "epargne") {
      epargne += -t.montant;
    } else if (ty === "revenu") {
      revenus += t.montant;
    } else {
      depenses += -t.montant;
      const k = t.categorieId ?? SANS_CATEGORIE;
      parCategorie.set(k, (parCategorie.get(k) ?? 0) - t.montant);
    }
  }
  return { revenus, depenses, epargne, solde: revenus - depenses, parCategorie };
}

export function moisAvecDonnees(txs: readonly Transaction[]): Mois[] {
  return [...new Set(txs.map((t) => moisDe(t.date)))].sort();
}

export interface CapaciteAuto {
  valeur: Cents; // peut être fractionnaire
  nbMois: number;
  mois: Mois[];
}

/** Moyenne de (revenus − dépenses) sur les 3 derniers mois complets ayant des transactions ; plancher 0. */
export function capaciteAuto(txs: readonly Transaction[], cats: IndexCategories, aujourdhui: DateISO): CapaciteAuto | null {
  const courant = moisDe(aujourdhui);
  const mois = moisAvecDonnees(txs).filter((m) => m < courant).slice(-3);
  if (!mois.length) return null;
  const total = mois.reduce((a, m) => a + bilan(txs, m, cats).solde, 0);
  return { valeur: Math.max(0, total / mois.length), nbMois: mois.length, mois };
}

export interface Capacite {
  valeur: Cents;
  source: "auto" | "manuel";
  nbMois?: number;
}

export function capacite(
  reglage: { mode: "auto" | "manuel"; manuelle: Cents },
  txs: readonly Transaction[],
  cats: IndexCategories,
  aujourdhui: DateISO,
): Capacite {
  if (reglage.mode === "auto") {
    const a = capaciteAuto(txs, cats, aujourdhui);
    if (a) return { valeur: a.valeur, source: "auto", nbMois: a.nbMois };
  }
  return { valeur: Math.max(0, reglage.manuelle), source: "manuel" };
}
