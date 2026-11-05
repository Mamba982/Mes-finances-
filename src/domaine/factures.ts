import type { Cents } from "./argent";
import type { IndexCategories, Transaction } from "./budget";
import { joursEntre, type DateISO } from "./dates";

/** Règles des factures et de l'état des résultats, reprises du prototype. */

export type StatutFacture = "brouillon" | "envoyee" | "payee";
export type StatutAffiche = StatutFacture | "retard";

export interface Facture {
  id: string;
  numero: string;
  client: string;
  courriel: string | null;
  description: string;
  montantHt: Cents;
  taxable: boolean;
  tauxTps: number; // en %, copié du profil à la création
  tauxTvq: number;
  tps: Cents;
  tvq: Cents;
  date: DateISO;
  echeance: DateISO | null;
  statut: StatutFacture;
  datePaiement: DateISO | null;
}

export const MOTIF_NUMERO = /^F-\d{4}-\d{3,}$/;

/** Prochain numéro F-AAAA-NNN de l'année : plus grand numéro de l'année + 1. */
export function prochainNumero(numeros: readonly string[], annee: number): string {
  let max = 0;
  for (const n of numeros) {
    const m = new RegExp(`^F-${annee}-(\\d+)$`).exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `F-${annee}-${String(max + 1).padStart(3, "0")}`;
}

/** TPS et TVQ arrondies au cent ; aucune taxe si la facture n'est pas taxable. */
export function taxes(montantHt: Cents, taxable: boolean, tauxTps: number, tauxTvq: number): { tps: Cents; tvq: Cents; total: Cents } {
  const tps = taxable ? Math.round((montantHt * tauxTps) / 100) : 0;
  const tvq = taxable ? Math.round((montantHt * tauxTvq) / 100) : 0;
  return { tps, tvq, total: montantHt + tps + tvq };
}

export function totalFacture(f: Pick<Facture, "montantHt" | "tps" | "tvq">): Cents {
  return f.montantHt + f.tps + f.tvq;
}

/** « En retard » : envoyée et échéance passée. */
export function statutAffiche(f: Pick<Facture, "statut" | "echeance">, aujourdhui: DateISO): StatutAffiche {
  if (f.statut === "envoyee" && f.echeance && f.echeance < aujourdhui) return "retard";
  return f.statut;
}

export function joursDeRetard(f: Pick<Facture, "echeance">, aujourdhui: DateISO): number {
  return f.echeance ? joursEntre(f.echeance, aujourdhui) : 0;
}

/** Frais d'un paiement par carte : pourcentage + frais fixes (2,9 % + 0,25 $ par défaut). */
export function fraisCarte(montant: Cents, pourcentage: number, fixe: Cents): Cents {
  return Math.round((montant * pourcentage) / 100 + fixe);
}

/** Seuil au-delà duquel on conseille de demander un virement Interac (règle du prototype). */
export const SEUIL_CONSEIL_VIREMENT = 5000;

export interface CoutEncaissement {
  carte: Cents;
  interac: Cents;
  difference: Cents;
  conseillerVirement: boolean;
}

export function coutEncaissement(montant: Cents, frais: { cartePct: number; carteFixe: Cents; interac: Cents }): CoutEncaissement {
  const carte = fraisCarte(montant, frais.cartePct, frais.carteFixe);
  const difference = carte - frais.interac;
  return { carte, interac: frais.interac, difference, conseillerVirement: difference > SEUIL_CONSEIL_VIREMENT };
}

export interface ResumeFactures {
  aRecevoir: Cents; // envoyées et en retard, TTC
  enRetard: Cents;
}

export function resumeFactures(factures: readonly Facture[], aujourdhui: DateISO): ResumeFactures {
  let aRecevoir = 0;
  let enRetard = 0;
  for (const f of factures) {
    const s = statutAffiche(f, aujourdhui);
    if (s === "envoyee" || s === "retard") aRecevoir += totalFacture(f);
    if (s === "retard") enRetard += totalFacture(f);
  }
  return { aRecevoir, enRetard };
}

export interface EtatResultats {
  revenus: Cents; // factures payées, avant taxes
  depenses: Cents; // dépenses déductibles, avant taxes
  benefice: Cents;
  tpsPercue: Cents;
  tvqPercue: Cents;
  cti: Cents; // crédits de taxe sur les intrants (TPS payée)
  rti: Cents; // remboursements de taxe sur les intrants (TVQ payée)
  taxesNettes: Cents; // (TPS perçue − CTI) + (TVQ perçue − RTI)
  parCategorie: Map<string, Cents>;
}

/** État des résultats annuel : estimation à faire valider par un comptable. */
export function etatResultats(
  factures: readonly Facture[],
  transactions: readonly Transaction[],
  cats: IndexCategories,
  annee: number,
  nomSansCategorie: string,
): EtatResultats {
  const an = String(annee);
  let revenus = 0;
  let tpsPercue = 0;
  let tvqPercue = 0;
  for (const f of factures) {
    if (f.statut !== "payee") continue;
    if ((f.datePaiement ?? f.date).slice(0, 4) !== an) continue;
    revenus += f.montantHt;
    tpsPercue += f.tps;
    tvqPercue += f.tvq;
  }
  let depenses = 0;
  let cti = 0;
  let rti = 0;
  const parCategorie = new Map<string, Cents>();
  for (const t of transactions) {
    if (!t.deductible || t.date.slice(0, 4) !== an) continue;
    const ht = -t.montant - t.tps - t.tvq;
    depenses += ht;
    cti += t.tps;
    rti += t.tvq;
    const nom = (t.categorieId && cats.get(t.categorieId)?.nom) || nomSansCategorie;
    parCategorie.set(nom, (parCategorie.get(nom) ?? 0) + ht);
  }
  return {
    revenus,
    depenses,
    benefice: revenus - depenses,
    tpsPercue,
    tvqPercue,
    cti,
    rti,
    taxesNettes: tpsPercue - cti + (tvqPercue - rti),
    parCategorie,
  };
}
