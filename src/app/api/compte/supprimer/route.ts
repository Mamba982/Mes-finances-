import { z } from "zod";
import { supabaseAdmin } from "@/donnees/admin-serveur";
import { supabaseServeur } from "@/donnees/supabase-serveur";
import { T } from "@/textes/fr-CA";

const reponse = (corps: object, statut: number) => Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
const schema = z.object({ confirmation: z.literal("SUPPRIMER") });

/**
 * Suppression du compte (Loi 25) : photos de reçus, puis l'utilisateur ; la base efface en cascade
 * toutes ses lignes (profil, catégories, règles, transactions, projets, factures, comptes, journal IA).
 */
export async function POST(req: Request) {
  const corps = schema.safeParse(await req.json().catch(() => null));
  if (!corps.success) return reponse({ erreur: T.compte.suppression.confirmationInvalide }, 400);

  const { data } = await (await supabaseServeur()).auth.getUser();
  const utilisateur = data.user;
  if (!utilisateur) return reponse({ erreur: T.ia.erreurs.session }, 401);

  const admin = supabaseAdmin();
  if (!admin) return reponse({ erreur: T.compte.suppression.indisponible }, 503);

  // Photos : le stockage ne suit pas la cascade de la base, on les retire d'abord.
  for (;;) {
    const { data: fichiers, error } = await admin.storage.from("recus").list(utilisateur.id, { limit: 100 });
    if (error) return reponse({ erreur: T.compte.suppression.echec }, 500);
    if (!fichiers.length) break;
    const r = await admin.storage.from("recus").remove(fichiers.map((f) => `${utilisateur.id}/${f.name}`));
    if (r.error) return reponse({ erreur: T.compte.suppression.echec }, 500);
  }

  const { error } = await admin.auth.admin.deleteUser(utilisateur.id);
  if (error) return reponse({ erreur: T.compte.suppression.echec }, 500);
  return reponse({ supprime: true }, 200);
}
