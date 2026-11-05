import type { Cents } from "./argent";
import type { CalculProjet } from "./projets";

/**
 * Information générale sur les placements, reprise du prototype (patrimoine, croissance, enveloppe,
 * calculateur de change). Aucun ordre, aucune garde d'argent, aucune recommandation de titre précis.
 */

export type TypeCompte = "celi" | "reer" | "celiapp" | "reee" | "non_enregistre" | "epargne" | "cheques" | "crypto" | "dette" | "autre";
export const TYPES_COMPTE: readonly TypeCompte[] = ["celi", "reer", "celiapp", "reee", "non_enregistre", "epargne", "cheques", "crypto", "dette", "autre"];

export interface Compte {
  id: string;
  nom: string;
  type: TypeCompte;
  solde: Cents; // une dette est saisie en positif
  majLe: string;
}

export interface Patrimoine {
  actifs: Cents;
  dettes: Cents;
  net: Cents;
}

export function patrimoine(comptes: readonly Compte[]): Patrimoine {
  let actifs = 0;
  let dettes = 0;
  for (const c of comptes) {
    if (c.type === "dette") dettes += c.solde;
    else actifs += c.solde;
  }
  return { actifs, dettes, net: actifs - dettes };
}

export interface Croissance {
  valeurFinale: Cents;
  valeurSansFrais: Cents;
  totalVerse: Cents;
  coutDesFrais: Cents;
  /** Valeur au départ, à la fin de chaque année, et à la fin de la durée (avec frais). */
  points: Cents[];
  pointsSansFrais: Cents[];
}

/**
 * Capitalisation mensuelle, versement en fin de mois, frais annuels soustraits du rendement.
 * Taux et frais en % par an ; durée en années (fractions permises).
 */
export function croissance(depart: Cents, mensuel: Cents, rendementPct: number, fraisPct: number, annees: number): Croissance {
  const r = (rendementPct - fraisPct) / 100 / 12;
  const r0 = rendementPct / 100 / 12;
  const n = Math.round(annees * 12);
  let v = depart;
  let v0 = depart;
  const points = [v];
  const pointsSansFrais = [v0];
  for (let i = 1; i <= n; i++) {
    v = v * (1 + r) + mensuel;
    v0 = v0 * (1 + r0) + mensuel;
    if (i % 12 === 0 || i === n) {
      points.push(v);
      pointsSansFrais.push(v0);
    }
  }
  return { valeurFinale: v, valeurSansFrais: v0, totalVerse: depart + mensuel * n, coutDesFrais: v0 - v, points, pointsSansFrais };
}

/** Bornes de la durée du simulateur (règle du prototype). */
export function borneDuree(annees: number): number {
  return Math.max(0.1, Math.min(50, annees));
}

export type Enveloppe = "celiapp" | "reee" | "court" | "moyen" | "long";

/** Type de compte suggéré pour l'argent d'un projet, selon son nom et son horizon (information générale). */
export function enveloppe(x: Pick<CalculProjet, "mois"> & { projet: { nom: string } }): Enveloppe {
  const n = x.projet.nom.toLowerCase();
  if (/maison|condo|propri[ée]t|achat.*(logement|immeuble)|mise de fonds/.test(n)) return "celiapp";
  if (/reee|enfant|[ée]tudes? (de|des) /.test(n)) return "reee";
  if (/urgence/.test(n) || x.mois <= 24) return "court";
  if (x.mois <= 60) return "moyen";
  return "long";
}

export interface CoutChange {
  allerMensuel: Cents;
  allerRetourMensuel: Cents;
  allerRetourAnnuel: Cents;
  /** Montant converti par mois au-delà duquel un compte en $ US paie son abonnement. */
  seuilRentabilite: Cents;
  compteUsRentable: boolean;
}

export function coutChange(montantMensuel: Cents, fraisPct: number, abonnementCompteUs: Cents): CoutChange {
  const p = fraisPct / 100;
  const aller = montantMensuel * p;
  const seuil = p > 0 ? abonnementCompteUs / p : 0;
  return {
    allerMensuel: aller,
    allerRetourMensuel: aller * 2,
    allerRetourAnnuel: aller * 2 * 12,
    seuilRentabilite: seuil,
    compteUsRentable: montantMensuel > seuil,
  };
}
