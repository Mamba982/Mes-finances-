/**
 * Remet en lignes le texte d'une page PDF (morceaux positionnés renvoyés par pdf.js), en gardant
 * l'alignement des colonnes : sur un relevé, c'est la colonne (Retraits ou Dépôts) qui donne le sens
 * d'un montant. Chaque morceau est placé à une colonne de caractère proportionnelle à son abscisse.
 * Fonction pure, testée sans navigateur.
 */
export interface MorceauTexte {
  texte: string;
  x: number; // abscisse en points, depuis la gauche
  y: number; // ordonnée en points, depuis le bas (convention PDF)
}

export const POINTS_PAR_COLONNE = 4;
const TOLERANCE_LIGNE = 2.5; // points
const LONGUEUR_MAX = 240;

export function lignesDepuisMorceaux(morceaux: readonly MorceauTexte[]): string[] {
  const utiles = morceaux.filter((m) => m.texte.trim());
  // Du haut vers le bas, puis de gauche à droite.
  const tries = [...utiles].sort((a, b) => b.y - a.y || a.x - b.x);
  const groupes: MorceauTexte[][] = [];
  for (const m of tries) {
    const g = groupes.at(-1);
    if (g && Math.abs(g[0]!.y - m.y) <= TOLERANCE_LIGNE) g.push(m);
    else groupes.push([m]);
  }
  return groupes.map((g) => {
    let ligne = "";
    for (const m of [...g].sort((a, b) => a.x - b.x)) {
      const colonne = Math.round(m.x / POINTS_PAR_COLONNE);
      ligne += ligne.length < colonne ? " ".repeat(colonne - ligne.length) : ligne && !ligne.endsWith(" ") ? " " : "";
      ligne += m.texte.trim();
    }
    return ligne.trimEnd().slice(0, LONGUEUR_MAX);
  });
}
