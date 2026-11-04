import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";

/**
 * Parcours connecté contre le vrai projet Supabase.
 * Demande SUPABASE_SECRET_KEY (clé secrète, jamais dans le dépôt) et un accès réseau à *.supabase.co.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

test.describe("socle avec session", () => {
  test.skip(!url || !secret, "SUPABASE_SECRET_KEY absent : parcours connecté non exécuté");

  test("un nouvel utilisateur arrive sur l'accueil par le lien magique et se déconnecte", async ({ page }) => {
    const admin = createClient(url!, secret!, { auth: { persistSession: false } });
    const courriel = `e2e-${Date.now()}@exemple.ca`;
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: courriel });
    expect(error).toBeNull();
    try {
      await page.goto(`/auth/confirmer?token_hash=${data.properties!.hashed_token}`);
      await expect(page).toHaveURL(/\/accueil$/);
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await expect(page.getByText("0 $").first()).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);

      await page.getByRole("link", { name: "Réglages" }).click();
      await page.getByRole("button", { name: "Me déconnecter" }).click();
      await expect(page).toHaveURL(/\/connexion$/);
    } finally {
      if (data.user) await admin.auth.admin.deleteUser(data.user.id);
    }
  });
});
