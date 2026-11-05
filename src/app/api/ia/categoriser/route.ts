import { createClient } from "@supabase/supabase-js";
import { aujourdhuiLocal } from "@/domaine/dates";
import { supabaseServeur } from "@/donnees/supabase-serveur";
import { envPublic } from "@/env";
import { verifierAcces } from "@/ia/acces";
import { categoriserAvecIa, ReponseIaInvalide, schemaDemande } from "@/ia/categoriser";
import { configIa } from "@/ia/config";
import { T } from "@/textes/fr-CA";

const erreur = (message: string, statut: number) => Response.json({ erreur: message }, { status: statut, headers: { "Cache-Control": "no-store" } });

/** Classe des transactions avec l'IA. Désactivée tant qu'aucune clé n'est configurée. */
export async function POST(req: Request) {
  const config = configIa();
  // Premier contrôle, avant toute lecture : sans clé, aucune requête ne part.
  if (!config.disponible) return erreur(T.ia.erreurs.indisponible, 503);

  const corps = schemaDemande.safeParse(await req.json().catch(() => null));
  if (!corps.success) return erreur(T.ia.erreurs.reponse, 400);

  const sb = await supabaseServeur();
  const { data: u } = await sb.auth.getUser();
  const jour = aujourdhuiLocal();
  const [profil, usage, categories] = u.user
    ? await Promise.all([
        sb.from("profils").select("ia_active").single(),
        sb.from("usage_ia").select("id", { count: "exact", head: true }).eq("jour", jour),
        sb.from("categories").select("id,nom,type"),
      ])
    : [null, null, null];

  const acces = verifierAcces({
    disponible: config.disponible,
    connecte: Boolean(u.user),
    iaActive: Boolean(profil?.data?.ia_active),
    utilisationsDuJour: usage?.count ?? 0,
    limite: config.limite,
  });
  if (!acces.ok) return erreur(T.ia.erreurs[acces.refus], acces.statut);

  const admin = createClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, config.cleSupabase!, { auth: { persistSession: false } });
  const journal = (succes: boolean, entree = 0, sortie = 0) =>
    admin.from("usage_ia").insert({ user_id: u.user!.id, jour, route: "categoriser", modele: config.modeleRapide, jetons_entree: entree, jetons_sortie: sortie, succes });

  try {
    const { appelClaude } = await import("@/ia/client");
    const r = await categoriserAvecIa(appelClaude(config.cle!, config.modeleRapide!), categories?.data ?? [], corps.data);
    await journal(true, r.jetonsEntree, r.jetonsSortie);
    return Response.json({ resultats: r.resultats }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await journal(false);
    return erreur(e instanceof ReponseIaInvalide ? T.ia.erreurs.reponse : T.ia.erreurs.connexion, 502);
  }
}
