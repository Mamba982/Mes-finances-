import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { aujourdhuiLocal } from "@/domaine/dates";
import { supabaseServeur } from "@/donnees/supabase-serveur";
import { envPublic } from "@/env";
import { T } from "@/textes/fr-CA";
import { verifierAcces } from "./acces";
import { type AppelModele, type Consommation, RefusModele, ReponseIaInvalide } from "./appel";
import { configIa } from "./config";

const reponse = (corps: object, statut = 200) => Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });

export interface ContexteIa {
  appel: AppelModele;
  /** Client Supabase de l'utilisateur (RLS) pour lire ses propres données. */
  sb: Awaited<ReturnType<typeof supabaseServeur>>;
  aujourdhui: string;
}

/**
 * Déroulé commun des routes /api/ia/* :
 * 1. sans clé : 503, avant toute lecture ou requête externe ;
 * 2. corps validé par Zod ; 3. session (401) ; 4. réglage de l'utilisateur (403) ; 5. limite du jour (429) ;
 * 6. appel au modèle, puis une ligne de journal (jetons), réussite ou échec.
 * Le traitement renvoie des données à afficher ou à faire réviser : rien n'est enregistré ici.
 */
export async function executerIa<S extends z.ZodType>(
  req: Request,
  route: string,
  schemaCorps: S,
  traitement: (corps: z.infer<S>, ctx: ContexteIa) => Promise<{ sortie: object; consommation: Consommation }>,
): Promise<Response> {
  const config = configIa();
  if (!config.disponible) return reponse({ erreur: T.ia.erreurs.indisponible }, 503);

  const corps = schemaCorps.safeParse(await req.json().catch(() => null));
  if (!corps.success) return reponse({ erreur: T.ia.erreurs.demande }, 400);

  const sb = await supabaseServeur();
  const { data: u } = await sb.auth.getUser();
  const jour = aujourdhuiLocal();
  const [profil, usage] = u.user
    ? await Promise.all([
        sb.from("profils").select("ia_active").single(),
        sb.from("usage_ia").select("id", { count: "exact", head: true }).eq("jour", jour),
      ])
    : [null, null];

  const acces = verifierAcces({
    disponible: config.disponible,
    connecte: Boolean(u.user),
    iaActive: Boolean(profil?.data?.ia_active),
    utilisationsDuJour: usage?.count ?? 0,
    limite: config.limite,
  });
  if (!acces.ok) {
    const message = acces.refus === "limite" ? T.ia.erreurs.limiteAtteinte(config.limite) : T.ia.erreurs[acces.refus];
    return reponse({ erreur: message }, acces.statut);
  }

  const admin = createClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, config.cleSupabase!, { auth: { persistSession: false } });
  const journal = (succes: boolean, c?: Consommation) =>
    admin.from("usage_ia").insert({
      user_id: u.user!.id,
      jour,
      route,
      modele: c?.modele ?? config.modeleComplet,
      jetons_entree: c?.jetonsEntree ?? 0,
      jetons_sortie: c?.jetonsSortie ?? 0,
      succes,
    });

  try {
    const { appelClaude } = await import("./client");
    const appel = appelClaude(config.cle!, { rapide: config.modeleRapide!, complet: config.modeleComplet! });
    const r = await traitement(corps.data, { appel, sb, aujourdhui: jour });
    await journal(true, r.consommation);
    return reponse(r.sortie);
  } catch (e) {
    await journal(false, e instanceof ReponseIaInvalide ? e.consommation : undefined);
    if (e instanceof RefusModele) return reponse({ erreur: T.ia.erreurs.refus }, 422);
    if (e instanceof ReponseIaInvalide) return reponse({ erreur: T.ia.erreurs.reponse }, 502);
    console.error(`IA ${route} :`, e instanceof Error ? e.message : e);
    return reponse({ erreur: T.ia.erreurs.connexion }, 502);
  }
}
