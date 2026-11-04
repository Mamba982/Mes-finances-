"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { envPublic } from "@/env";

let client: SupabaseClient | null = null;

/** Client unique côté navigateur. La RLS protège chaque lecture et chaque écriture. */
export function supabaseNavigateur(): SupabaseClient {
  client ??= createBrowserClient(envPublic.NEXT_PUBLIC_SUPABASE_URL, envPublic.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
