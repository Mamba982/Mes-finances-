import { lireReleveAvecIa, schemaDemandeReleve } from "@/ia/releve";
import { executerIa } from "@/ia/route";

// Un relevé de plusieurs pages peut demander une minute ou plus de lecture.
export const maxDuration = 300;

/** Lit un relevé (texte PDF masqué sur l'appareil, ou capture d'écran). Ne fait que proposer : l'écran de revue enregistre. */
export async function POST(req: Request) {
  return executerIa(req, "releve", schemaDemandeReleve, async (d, { appel }) => {
    const r = await lireReleveAvecIa(appel, d);
    return { sortie: { lignes: r.lignes, ecartees: r.ecartees }, consommation: r };
  });
}
