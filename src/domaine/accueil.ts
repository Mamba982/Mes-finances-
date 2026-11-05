import type { Cents } from "./argent";
import { bilan, type Categorie, type IndexCategories, type Transaction } from "./budget";
import { ajouterMois, moisDe, type DateISO } from "./dates";
import type { Radar } from "./radar";

/**
 * Liste « À faire ce mois-ci », dans l'ordre du prototype.
 * Les éléments liés aux projets (phase 3) et aux factures (phase 4) s'ajoutent ici.
 */
export type ElementAFaire =
  | { type: "aucune-transaction"; ton: "warn" }
  | { type: "a-classer"; ton: "warn"; nombre: number }
  | { type: "budget-depasse"; ton: "warn"; categorie: string; depassement: Cents }
  | { type: "frais"; ton: "warn"; total: Cents };

export function aFaireBudget(entree: {
  transactions: readonly Transaction[];
  categories: readonly Categorie[];
  index: IndexCategories;
  radar: Radar;
  aujourdhui: DateISO;
}): ElementAFaire[] {
  const { transactions, categories, index, radar, aujourdhui } = entree;
  const ym = moisDe(aujourdhui);
  const liste: ElementAFaire[] = [];
  const precedent = ajouterMois(ym, -1);
  if (!transactions.some((t) => moisDe(t.date) === ym || moisDe(t.date) === precedent)) liste.push({ type: "aucune-transaction", ton: "warn" });
  const nonClassees = transactions.filter((t) => !t.categorieId).length;
  if (nonClassees) liste.push({ type: "a-classer", ton: "warn", nombre: nonClassees });
  const b = bilan(transactions, ym, index);
  for (const c of categories) {
    const d = b.parCategorie.get(c.id) ?? 0;
    if (c.type === "depense" && c.budget > 0 && d > c.budget) liste.push({ type: "budget-depasse", ton: "warn", categorie: c.nom, depassement: d - c.budget });
  }
  if (radar.totalFrais > 0) liste.push({ type: "frais", ton: "warn", total: radar.totalFrais });
  return liste;
}
