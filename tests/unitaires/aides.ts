import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categorie, Transaction } from "@/domaine/budget";
import { categorieAuto, normaliserMarchand } from "@/domaine/categorisation";

/** Les 18 catégories par défaut, avec id = code (comme dans le prototype). */
export const CATEGORIES: Categorie[] = (
  [
    ["salaire", "Salaire et prestations", "revenu", 0],
    ["rev-entreprise", "Revenus d'entreprise", "revenu", 0],
    ["autres-revenus", "Autres revenus", "revenu", 0],
    ["logement", "Logement (loyer, Hydro)", "depense", 115000],
    ["epicerie", "Épicerie", "depense", 38000],
    ["restaurants", "Restaurants", "depense", 9000],
    ["transport", "Transport", "depense", 11000],
    ["telecom", "Cellulaire et Internet", "depense", 9500],
    ["abonnements", "Abonnements", "depense", 3500],
    ["sante", "Santé et pharmacie", "depense", 4000],
    ["achats", "Achats", "depense", 10000],
    ["loisirs", "Loisirs", "depense", 6000],
    ["education", "Éducation", "depense", 0],
    ["famille", "Envois à la famille", "depense", 15000],
    ["frais", "Frais bancaires", "depense", 0],
    ["affaires", "Dépenses d'entreprise", "depense", 0],
    ["autres", "Autres dépenses", "depense", 5000],
    ["epargne", "Épargne et projets", "epargne", 0],
  ] as const
).map(([code, nom, type, budget]) => ({ id: code, code, nom, type, budget }));

export const RELEVES = join(import.meta.dirname, "../fixtures/releves");

/** Les transactions de référence des relevés fictifs, classées par les règles automatiques. */
export function transactionsReleves(): Transaction[] {
  const brut = JSON.parse(readFileSync(join(RELEVES, "attendu.json"), "utf8")) as { date: string; libelle: string; montant: number }[];
  return brut.map((l, i) => ({
    id: `t${i}`,
    date: l.date,
    libelle: l.libelle,
    marchand: normaliserMarchand(l.libelle),
    montant: l.montant,
    categorieId: categorieAuto(l.libelle, l.montant),
    deductible: false,
    tps: 0,
    tvq: 0,
  }));
}
