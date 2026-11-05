import type { Cents } from "./argent";
import { categorieAuto, normaliserMarchand } from "./categorisation";

/**
 * Classement par règles de mots-clés, sans IA.
 * 1. Règles de l'utilisateur (ajoutées à la main ou retenues après une correction) : la plus précise gagne.
 * 2. Règles par défaut reprises du prototype.
 */

export type OrigineRegle = "manuel" | "auto";

export interface RegleCategorie {
  id: string;
  motif: string; // texte normalisé : minuscules, sans accents, mots séparés par une espace
  categorieId: string;
  origine: OrigineRegle;
}

/** « Épicerie MAXI #8812 » → « epicerie maxi 8812 » */
export function normaliserTexte(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const LONGUEUR_MOTIF = { min: 2, max: 80 } as const;

/** Motif valide pour une règle, ou null. */
export function motifValide(saisie: string): string | null {
  const m = normaliserTexte(saisie);
  return m.length >= LONGUEUR_MOTIF.min && m.length <= LONGUEUR_MOTIF.max ? m : null;
}

/** Motif retenu après une correction : le marchand normalisé (« MAXI #8812 QUEBEC » → « maxi quebec »). */
export function motifDepuisLibelle(libelle: string): string | null {
  return motifValide(normaliserMarchand(libelle));
}

function contient(texte: string, motif: string): boolean {
  return ` ${texte} `.includes(` ${motif} `);
}

/** La règle qui s'applique au libellé : le motif le plus long ; à égalité, une règle ajoutée à la main. */
export function regleApplicable(regles: readonly RegleCategorie[], libelle: string): RegleCategorie | null {
  const brut = normaliserTexte(libelle);
  const marchand = normaliserTexte(normaliserMarchand(libelle));
  let meilleure: RegleCategorie | null = null;
  for (const r of regles) {
    if (!contient(brut, r.motif) && !contient(marchand, r.motif)) continue;
    if (
      !meilleure ||
      r.motif.length > meilleure.motif.length ||
      (r.motif.length === meilleure.motif.length && r.origine === "manuel" && meilleure.origine === "auto")
    ) {
      meilleure = r;
    }
  }
  return meilleure;
}

export type SourceClassement = "regle" | "defaut";

export interface Classement {
  categorieId: string;
  source: SourceClassement;
  motif?: string;
}

/**
 * Catégorie proposée pour une ligne. parCode relie les codes des règles par défaut
 * (« epicerie ») aux catégories de l'utilisateur.
 */
export function classer(
  libelle: string,
  montant: Cents,
  regles: readonly RegleCategorie[],
  parCode: ReadonlyMap<string, string>,
): Classement | null {
  const r = regleApplicable(regles, libelle);
  if (r) return { categorieId: r.categorieId, source: "regle", motif: r.motif };
  const code = categorieAuto(libelle, montant);
  const id = code ? parCode.get(code) : undefined;
  return id ? { categorieId: id, source: "defaut" } : null;
}
