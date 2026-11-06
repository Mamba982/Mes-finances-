import { categoriserAvecIa, schemaDemande } from "@/ia/categoriser";
import { executerIa } from "@/ia/route";

/** Classe avec l'IA les transactions qu'aucune règle n'a reconnues. Ne fait que proposer : le client enregistre. */
export async function POST(req: Request) {
  return executerIa(req, "categoriser", schemaDemande, async (d, { appel, sb }) => {
    const { data: categories } = await sb.from("categories").select("id,nom,type");
    const r = await categoriserAvecIa(appel, categories ?? [], d);
    return { sortie: { resultats: r.resultats }, consommation: r };
  });
}
