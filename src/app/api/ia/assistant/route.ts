import { repondreAvecIa, schemaDemandeAssistant } from "@/ia/assistant";
import { executerIa } from "@/ia/route";

export const maxDuration = 60;

/** Répond à une question à partir du résumé calculé sur l'appareil. Rien n'est enregistré. */
export async function POST(req: Request) {
  return executerIa(req, "assistant", schemaDemandeAssistant, async (d, { appel }) => {
    const r = await repondreAvecIa(appel, d);
    return { sortie: { reponse: r.reponse }, consommation: r };
  });
}
