import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

test.describe("socle avec session", () => {
  test.skip(!url || !secret, raisonSaut);

  test("un nouvel utilisateur arrive sur l'accueil par le lien magique et se déconnecte", async ({ page }) => {
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await expect(page.getByText("Aucune transaction récente.")).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);

      await page.getByRole("link", { name: "Réglages" }).click();
      await page.getByRole("button", { name: "Me déconnecter" }).click();
      await expect(page).toHaveURL(/\/connexion$/);
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
