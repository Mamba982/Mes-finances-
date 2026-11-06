/**
 * Coût d'un appel en dollars américains, d'après les jetons du journal (usage_ia).
 * Tarifs publics d'Anthropic par million de jetons, au 2026-11-06 ; à mettre à jour s'ils changent.
 * Haiku 5.5 : tarif bas jusqu'à 100 000 jetons d'entrée par requête (toujours le cas ici).
 */
const TARIFS: Record<string, { entree: number; sortie: number }> = {
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10 },
  "claude-opus-5-5": { entree: 4, sortie: 20 },
};

export function coutUsd(modele: string, jetonsEntree: number, jetonsSortie: number): number | null {
  const t = TARIFS[modele];
  if (!t) return null;
  return (jetonsEntree * t.entree + jetonsSortie * t.sortie) / 1_000_000;
}
