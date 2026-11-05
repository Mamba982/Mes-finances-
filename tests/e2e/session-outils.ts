import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

/**
 * Parcours connectés contre le vrai projet Supabase. Demande SUPABASE_SECRET_KEY
 * (secret de l'environnement, jamais dans le dépôt) et un accès réseau à *.supabase.co.
 */
export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const secret = process.env.SUPABASE_SECRET_KEY;
export const raisonSaut = "SUPABASE_SECRET_KEY ou NEXT_PUBLIC_SUPABASE_URL absent : parcours connecté non exécuté";

export function admin(): SupabaseClient {
  return createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Crée un utilisateur de test, ouvre sa session par lien magique et renvoie son id (à supprimer ensuite). */
export async function connecterNouvelUtilisateur(page: Page): Promise<string> {
  const a = admin();
  const courriel = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@exemple.ca`;
  const cree = await a.auth.admin.createUser({ email: courriel, email_confirm: true });
  expect(cree.error).toBeNull();
  const lien = await a.auth.admin.generateLink({ type: "magiclink", email: courriel });
  expect(lien.error).toBeNull();
  await page.goto(`/auth/confirmer?token_hash=${lien.data.properties!.hashed_token}`);
  await expect(page).toHaveURL(/\/accueil$/);
  return cree.data.user!.id;
}

export async function supprimerUtilisateur(id: string | undefined): Promise<void> {
  if (id) await admin().auth.admin.deleteUser(id);
}
