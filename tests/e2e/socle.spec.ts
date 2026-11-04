import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";

test.describe("socle sans session", () => {
  test("une page protégée renvoie vers la connexion", async ({ page }) => {
    await page.goto("/accueil");
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  });

  test("la connexion est en français, accessible, et valide le courriel avant tout envoi", async ({ page }) => {
    let appelsSupabase = 0;
    page.on("request", (r) => {
      if (r.url().includes(".supabase.co/auth/")) appelsSupabase++;
    });
    await page.goto("/connexion");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
    await sansTexteAnglais(page);
    await accessible(page);

    await page.getByLabel("Courriel").fill("pas-un-courriel");
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
    await expect(page.getByRole("status")).toHaveText(/adresse courriel valide/);
    expect(appelsSupabase).toBe(0);
    await sansTexteAnglais(page);
  });

  test("le thème sombre suit le réglage du téléphone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/connexion");
    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fond).toBe("rgb(15, 21, 19)");
    await accessible(page);
  });

  test("une adresse inconnue affiche une page en français", async ({ page }) => {
    const r = await page.goto("/nimporte-quoi");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await sansTexteAnglais(page);
  });

  test("la politique de confidentialité est publique et en français", async ({ page }) => {
    await page.goto("/confidentialite");
    await expect(page.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeVisible();
    await sansTexteAnglais(page);
    await accessible(page);
  });
});
