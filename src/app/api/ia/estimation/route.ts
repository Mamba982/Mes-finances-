import { estimerAvecIa, schemaDemandeEstimation } from "@/ia/estimation";
import { executerIa } from "@/ia/route";

export const maxDuration = 60;

/** Propose des postes pour un projet. Rien n'est enregistré : la liste de revue ajoute les postes retenus. */
export async function POST(req: Request) {
  return executerIa(req, "estimation", schemaDemandeEstimation, async (d, { appel }) => {
    const r = await estimerAvecIa(appel, d);
    return { sortie: { postes: r.postes }, consommation: r };
  });
}
