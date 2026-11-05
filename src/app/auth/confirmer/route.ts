import type { NextRequest } from "next/server";
import { supabaseServeur } from "@/donnees/supabase-serveur";

/** Arrivée depuis le lien magique : échange le code contre une session, puis va à l'accueil. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const supabase = await supabaseServeur();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })).error;
  }

  // Redirection relative : le navigateur reste sur l'hôte où les cookies de session viennent d'être posés
  // (une URL absolue construite côté serveur peut être normalisée, ex. 127.0.0.1 → localhost).
  return new Response(null, {
    status: 303,
    headers: { Location: ok ? "/accueil" : "/connexion?erreur=lien", "Cache-Control": "private, no-store" },
  });
}
