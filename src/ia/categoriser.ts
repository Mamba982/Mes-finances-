import { z } from "zod";
import { centsVersDecimal } from "@/domaine/argent";
import { masquerNumeros } from "@/domaine/masquage";
import type { AppelModele } from "./appel";

/**
 * Classement par l'IA des transactions qu'aucune règle n'a reconnues. Le modèle choisit seulement
 * une catégorie parmi celles de l'utilisateur ; il ne calcule rien. Seuls la date, le libellé
 * (numéros masqués) et le montant sont envoyés. Une réponse hors schéma est rejetée en entier.
 */

export const MAX_TRANSACTIONS = 120;

export const schemaDemande = z.object({
  transactions: z
    .array(
      z.object({
        id: z.uuid(),
        date: z.iso.date(),
        libelle: z.string().min(1).max(300),
        montant: z.number().int(), // cents
      }),
    )
    .min(1)
    .max(MAX_TRANSACTIONS),
});
export type DemandeCategorisation = z.infer<typeof schemaDemande>;

export interface CategoriePermise {
  id: string;
  nom: string;
  type: "revenu" | "depense" | "epargne";
  code?: string | null;
}

/**
 * Catégories proposées au modèle. « Dépenses d'entreprise » en est exclue : elle rend la dépense
 * déductible (impôts), une décision qui revient à l'utilisateur (essai réel : RONA y était classée).
 */
export const CODES_EXCLUS_IA: readonly string[] = ["affaires"];
export function categoriesPourIa(categories: readonly CategoriePermise[]): CategoriePermise[] {
  return categories.filter((c) => !c.code || !CODES_EXCLUS_IA.includes(c.code));
}

/** Réponse attendue : un objet par transaction, indice dans la liste envoyée et id de catégorie ou « inconnu ». */
export const schemaReponse = z.object({
  resultats: z.array(z.object({ i: z.number().int(), categorie: z.string() })),
});

const SYSTEME = [
  "Tu classes des transactions bancaires canadiennes dans les catégories permises.",
  "Un montant positif est une entrée d'argent, un montant négatif une sortie.",
  "Pour chaque transaction, donne son numéro i et l'id d'une catégorie permise.",
  "Classe selon l'activité principale du commerçant, pas selon un mot isolé de son nom.",
  "La catégorie d'épargne sert seulement aux dépôts vers l'épargne ou les placements (CELI, REER, compte épargne).",
  "Un paiement de carte de crédit ou un virement entre comptes n'est ni une dépense ni de l'épargne : mets \"inconnu\".",
  'Mets "inconnu" si tu n\'es pas raisonnablement sûr. N\'invente aucune catégorie.',
].join("\n");

export function construireConsigne(categories: readonly CategoriePermise[], d: DemandeCategorisation): { systeme: string; contenu: string } {
  const contenu = JSON.stringify({
    categories: categories.map((c) => ({ id: c.id, nom: c.nom, type: c.type })),
    transactions: d.transactions.map((t, i) => ({ i, date: t.date, libelle: masquerNumeros(t.libelle), montant: centsVersDecimal(t.montant) })),
  });
  return { systeme: SYSTEME, contenu };
}

/** Ramène la réponse aux identifiants connus : indice valide, une fois, catégorie permise. */
export function interpreterReponse(
  r: z.infer<typeof schemaReponse>,
  d: DemandeCategorisation,
  categories: readonly CategoriePermise[],
): { id: string; categorieId: string }[] {
  const permis = new Set(categories.map((c) => c.id));
  const vus = new Set<number>();
  const sortie: { id: string; categorieId: string }[] = [];
  for (const { i, categorie } of r.resultats) {
    const t = d.transactions[i];
    if (!t || vus.has(i) || !permis.has(categorie)) continue; // indice inconnu, doublon, « inconnu » ou catégorie inventée
    vus.add(i);
    sortie.push({ id: t.id, categorieId: categorie });
  }
  return sortie;
}

export async function categoriserAvecIa(appel: AppelModele, toutes: readonly CategoriePermise[], d: DemandeCategorisation) {
  const categories = categoriesPourIa(toutes);
  const r = await appel({ ...construireConsigne(categories, d), schema: schemaReponse, gamme: "rapide", maxJetons: 8000 });
  return { resultats: interpreterReponse(r.donnees, d, categories), modele: r.modele, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie };
}
