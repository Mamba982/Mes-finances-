import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { envPublic } from "@/env";

/** Client avec la clé secrète (contourne la RLS) : serveur seulement, pour les opérations sur le compte. */
export function supabaseAdmin(): SupabaseClient | null {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) return null;
  return createClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}
