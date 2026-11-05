import { expect, test, type Page } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

async function ajouterCompte(page: Page, nom: string, type: string, solde: string) {
  await page.getByRole("button", { name: "Ajouter un compte" }).click();
  const d = page.getByRole("dialog", { name: "Nouveau compte" });
  await d.getByLabel("Nom").fill(nom);
  await d.getByLabel("Type").selectOption({ label: type });
  await d.getByLabel("Solde (pour une dette, le montant dû)").fill(solde);
  await d.getByRole("button", { name: "Enregistrer" }).click();
  await expect(d).toBeHidden();
}

const kpi = (page: Page, libelle: string) => page.locator(".carte", { has: page.getByText(libelle, { exact: true }) }).first();

test.describe("placements : parcours principal", () => {
  test.skip(!url || !secret, raisonSaut);
  test.setTimeout(90_000);

  test("comptes et avoir net, simulateur de croissance, frais de change ; information générale visible", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await page.getByRole("link", { name: "Placements" }).click();
      await expect(page.getByText(/C'est de l'information générale, pas un conseil de placement personnalisé\./)).toBeVisible();

      // Comptes de l'exemple du prototype : avoir net 2 400 + 1 200 − 640 = 2 960 $
      await ajouterCompte(page, "CELI", "CELI", "2400");
      await ajouterCompte(page, "Compte épargne", "Épargne", "1200");
      await ajouterCompte(page, "Carte de crédit", "Dette", "640");
      await expect(kpi(page, "Avoir net")).toContainText("2 960 $");
      await expect(kpi(page, "Dettes")).toContainText("640 $");

      // Modifier la dette met l'avoir net à jour
      await page.getByRole("button", { name: "Modifier Carte de crédit" }).click();
      const d = page.getByRole("dialog", { name: "Modifier le compte" });
      await d.getByLabel("Solde (pour une dette, le montant dû)").fill("500");
      await d.getByRole("button", { name: "Enregistrer" }).click();
      await expect(kpi(page, "Avoir net")).toContainText("3 100 $");

      // Simulateur : 1 000 $ + 200 $/mois, 5 % moins 2 % de frais, 10 ans
      await expect(kpi(page, "Total versé")).toContainText("25 000 $");
      await expect(kpi(page, "Coût des frais")).toContainText("3 406 $");
      await page.getByLabel("Frais annuels (%)").fill("0,25");
      await expect(kpi(page, "Coût des frais")).not.toContainText("3 406 $");

      // Frais de change : 5 000 $ par mois à 1,5 %
      await expect(kpi(page, "Coût par mois (aller)")).toContainText("75,00 $");
      await expect(kpi(page, "Aller-retour (achat puis vente)")).toContainText("sur un an : 1 800 $");
      await expect(page.getByText("rentable au-delà de 667 $ convertis par mois")).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);

      // L'accueil montre l'avoir net
      await page.getByRole("link", { name: "Accueil" }).click();
      await expect(kpi(page, "Avoir net")).toContainText("3 100 $");
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
