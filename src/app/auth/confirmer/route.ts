import { NextResponse, type NextRequest } from "next/server";
import { supabaseServeur } from "@/donnees/supabase-serveur";

/** Arrivée depuis le lien magique : échange le code contre une session, puis va à l'accueil. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const supabase = await supabaseServeur();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })).error;
  }

  const cible = new URL(ok ? "/accueil" : "/connexion?erreur=lien", url.origin);
  const res = NextResponse.redirect(cible);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
