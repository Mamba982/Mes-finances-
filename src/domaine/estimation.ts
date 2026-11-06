import type { Cents } from "./argent";

/**
 * Montant d'un poste estimé = quantité × prix unitaire, arrondi au cent.
 * La multiplication est faite ici : le modèle ne donne que la quantité et le prix unitaire.
 */
export const QUANTITE_MAX = 1000;

export function montantPoste(quantite: number, prixUnitaire: Cents): Cents | null {
  if (!Number.isFinite(quantite) || quantite <= 0 || quantite > QUANTITE_MAX) return null;
  if (!Number.isInteger(prixUnitaire) || prixUnitaire < 0) return null;
  return Math.round(quantite * prixUnitaire);
}
