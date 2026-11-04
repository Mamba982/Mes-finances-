import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { envPublic } from "@/env";

/** Client serveur lié à la session de la requête (cookies). La RLS s'applique. */
export async function supabaseServeur(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, envPublic.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (liste) => {
        for (const { name, value, options } of liste) jar.set(name, value, options);
      },
    },
  });
}
