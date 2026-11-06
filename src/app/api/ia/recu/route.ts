import { lireRecuAvecIa, schemaDemandeRecu } from "@/ia/recu";
import { executerIa } from "@/ia/route";

export const maxDuration = 60;

/** Lit la photo d'un reçu et renvoie de quoi préremplir le formulaire. Rien n'est enregistré. */
export async function POST(req: Request) {
  return executerIa(req, "recu", schemaDemandeRecu, async (d, { appel }) => {
    const r = await lireRecuAvecIa(appel, d);
    return { sortie: { recu: r.recu }, consommation: r };
  });
}
