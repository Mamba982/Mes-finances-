import type { Cents } from "./argent";
import { bilan, type Categorie, type IndexCategories, type Transaction } from "./budget";
import { ajouterMois, moisDe, type DateISO } from "./dates";
import { joursDeRetard, statutAffiche, totalFacture, type Facture } from "./factures";
import type { Repartition } from "./projets";
import type { Radar } from "./radar";

/**
 * Liste « À faire ce mois-ci », dans l'ordre du prototype.
 * Les éléments liés aux projets (phase 3) et aux factures (phase 4) s'ajoutent ici.
 */
export type ElementAFaire =
  | { type: "manque"; ton: "bad"; montant: Cents }
  | { type: "verser"; ton: "ok"; montant: Cents; projet: string }
  | { type: "aucune-transaction"; ton: "warn" }
  | { type: "a-classer"; ton: "warn"; nombre: number }
  | { type: "budget-depasse"; ton: "warn"; categorie: string; depassement: Cents }
  | { type: "relance"; ton: "bad"; client: string; numero: string; total: Cents; jours: number }
  | { type: "frais"; ton: "warn"; total: Cents };

export function aFaireBudget(entree: {
  transactions: readonly Transaction[];
  categories: readonly Categorie[];
  index: IndexCategories;
  radar: Radar;
  aujourdhui: DateISO;
  factures?: readonly Facture[];
}): ElementAFaire[] {
  const { transactions, categories, index, radar, aujourdhui, factures = [] } = entree;
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
  for (const f of factures) {
    if (statutAffiche(f, aujourdhui) === "retard")
      liste.push({ type: "relance", ton: "bad", client: f.client, numero: f.numero, total: totalFacture(f), jours: joursDeRetard(f, aujourdhui) });
  }
  if (radar.totalFrais > 0) liste.push({ type: "frais", ton: "warn", total: radar.totalFrais });
  return liste;
}

/** Éléments liés aux projets : manque mensuel, puis versements du mois (4 au plus, par priorité). */
export function aFaireProjets(r: Repartition): ElementAFaire[] {
  const liste: ElementAFaire[] = [];
  if (r.ecart < 0) liste.push({ type: "manque", ton: "bad", montant: -r.ecart });
  r.projets
    .filter((x) => x.alloue > 0)
    .sort((a, b) => a.projet.priorite - b.projet.priorite)
    .slice(0, 4)
    .forEach((x) => liste.push({ type: "verser", ton: "ok", montant: x.alloue, projet: x.projet.nom }));
  return liste;
}
