import type { Cents } from "./argent";
import { normaliserMarchand } from "./categorisation";
import { joursEntre, type DateISO } from "./dates";

export interface LigneComparable {
  date: DateISO;
  libelle: string;
  montant: Cents;
}

export type StatutDoublon = "exact" | "probable" | null;

/** Mots significatifs : plus de 2 caractères, pas seulement des chiffres (règle du prototype). */
export function mots(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));
}

/** Indice de Jaccard sur les mots. */
export function similarite(a: string, b: string): number {
  const A = mots(a);
  const B = mots(b);
  if (!A.length || !B.length) return 0;
  const sa = new Set(A);
  const union = new Set([...A, ...B]);
  let inter = 0;
  for (const w of new Set(B)) if (sa.has(w)) inter++;
  return inter / union.size;
}

/** Clé d'un doublon exact : date + montant + libellé normalisé. */
export function cleDoublon(t: LigneComparable): string {
  return `${t.date}|${(t.montant / 100).toFixed(2)}|${mots(t.libelle).join(" ")}`;
}

export const SEUIL_SIMILARITE = 0.4;
export const ECART_JOURS = 3;

/**
 * Statut de chaque ligne importée face aux transactions déjà enregistrées.
 * Exact : même clé qu'une transaction existante ou qu'une ligne précédente du même fichier.
 * Probable : même montant, ≤ 3 jours d'écart, et libellés semblables (≥ 0,4) ou même marchand.
 */
export function marquerDoublons(lignes: readonly LigneComparable[], base: readonly LigneComparable[]): StatutDoublon[] {
  const cles = new Set(base.map(cleDoublon));
  const vues = new Set<string>();
  return lignes.map((r) => {
    const k = cleDoublon(r);
    let statut: StatutDoublon = null;
    if (cles.has(k) || vues.has(k)) statut = "exact";
    else {
      const m = base.find(
        (t) =>
          t.montant === r.montant &&
          Math.abs(joursEntre(t.date, r.date)) <= ECART_JOURS &&
          (similarite(t.libelle, r.libelle) >= SEUIL_SIMILARITE || normaliserMarchand(t.libelle) === normaliserMarchand(r.libelle)),
      );
      if (m) statut = "probable";
    }
    vues.add(k);
    return statut;
  });
}

async function sha256(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Empreinte stockée en base (unique par utilisateur) : clé de doublon + rang de la ligne parmi
 * les lignes identiques du même fichier. Réimporter le fichier redonne les mêmes empreintes ;
 * deux achats identiques le même jour gardent des empreintes distinctes.
 */
export async function empreintes(lignes: readonly LigneComparable[]): Promise<string[]> {
  const rangs = new Map<string, number>();
  return Promise.all(
    lignes.map((l) => {
      const k = cleDoublon(l);
      const rang = (rangs.get(k) ?? 0) + 1;
      rangs.set(k, rang);
      return sha256(`${k}#${rang}`);
    }),
  );
}
