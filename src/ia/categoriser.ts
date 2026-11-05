import { z } from "zod";

/**
 * Classement des transactions restantes par l'IA. Le modèle choisit seulement une catégorie
 * parmi celles de l'utilisateur ; il ne calcule rien. Sa réponse est validée par Zod :
 * une réponse invalide est rejetée en entier, rien n'est appliqué.
 */

export const MAX_TRANSACTIONS = 120;

export const schemaDemande = z.object({
  transactions: z
    .array(
      z.object({
        id: z.uuid(),
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
}

/** Réponse attendue : un objet par transaction, indice dans la liste envoyée et id de catégorie ou « inconnu ». */
export const schemaReponse = z.object({
  resultats: z.array(z.object({ i: z.number().int().min(0), categorie: z.string().min(1) })),
});

export class ReponseIaInvalide extends Error {}

export function construireConsigne(categories: readonly CategoriePermise[], d: DemandeCategorisation): { systeme: string; message: string } {
  const systeme = [
    "Tu classes des transactions bancaires canadiennes dans les catégories permises.",
    "Un montant positif est une entrée d'argent, négatif une sortie (montants en cents).",
    'Réponds UNIQUEMENT avec un objet JSON : {"resultats":[{"i":numéro,"categorie":"id"}]}.',
    'Mets "inconnu" si tu n\'es pas raisonnablement sûr. N\'invente aucune catégorie.',
  ].join("\n");
  const message = JSON.stringify({
    categories: categories.map((c) => ({ id: c.id, nom: c.nom, type: c.type })),
    transactions: d.transactions.map((t, i) => ({ i, libelle: t.libelle, montant: t.montant })),
  });
  return { systeme, message };
}

/** Valide la réponse brute du modèle et la ramène aux identifiants de transactions et de catégories connus. */
export function interpreterReponse(
  texte: string,
  d: DemandeCategorisation,
  categories: readonly CategoriePermise[],
): { id: string; categorieId: string }[] {
  let brut: unknown;
  try {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    brut = JSON.parse(debut >= 0 && fin > debut ? texte.slice(debut, fin + 1) : texte);
  } catch {
    throw new ReponseIaInvalide("JSON illisible");
  }
  const v = schemaReponse.safeParse(brut);
  if (!v.success) throw new ReponseIaInvalide("schéma");
  const permis = new Set(categories.map((c) => c.id));
  const vus = new Set<number>();
  const sortie: { id: string; categorieId: string }[] = [];
  for (const r of v.data.resultats) {
    const t = d.transactions[r.i];
    if (!t || vus.has(r.i) || !permis.has(r.categorie)) continue; // indice inconnu, doublon, « inconnu » ou catégorie inventée
    vus.add(r.i);
    sortie.push({ id: t.id, categorieId: r.categorie });
  }
  return sortie;
}

/** Appel au modèle, injecté : le vrai client vit dans src/ia/client.ts, les tests passent un faux. */
export type AppelModele = (p: { systeme: string; message: string }) => Promise<{ texte: string; jetonsEntree: number; jetonsSortie: number }>;

export async function categoriserAvecIa(appel: AppelModele, categories: readonly CategoriePermise[], d: DemandeCategorisation) {
  const r = await appel(construireConsigne(categories, d));
  return { resultats: interpreterReponse(r.texte, d, categories), jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie };
}
