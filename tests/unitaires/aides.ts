import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categorie, Transaction } from "@/domaine/budget";
import type { Projet } from "@/domaine/projets";
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

export const AUJOURDHUI = "2026-11-04";

/** Les trois projets d'exemple du prototype (montants en cents). */
export function projetsExemple(): Projet[] {
  return [
    {
      id: "p1", nom: "Fonds d'urgence", cout: 500000, montantDepart: 120000, echeance: "2027-09-04", priorite: 1,
      notes: "Trois mois de dépenses de base.", postes: [],
      versements: [{ id: "m1", montant: 30000, date: "2026-10-03", note: "Virement mensuel" }],
    },
    {
      id: "p2", nom: "Formation professionnelle", cout: 380000, montantDepart: 40000, echeance: "2028-01-04", priorite: 2,
      notes: null, versements: [],
      postes: [
        { id: "q1", nom: "Droits de scolarité", montant: 260000, explication: null },
        { id: "q2", nom: "Livres et matériel", montant: 35000, explication: null },
      ],
    },
    { id: "p3", nom: "Ordinateur portable", cout: 160000, montantDepart: 0, echeance: "2027-05-04", priorite: 3, notes: null, postes: [], versements: [] },
  ];
}
