import { expect, test, type Page } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

async function creerProjet(page: Page, p: { nom: string; cout: string; depart: string; echeance: string; priorite: string }) {
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  const d = page.getByRole("dialog", { name: "Nouveau projet" });
  await d.getByLabel("Nom du projet").fill(p.nom);
  await d.getByLabel("Coût total").fill(p.cout);
  await d.getByLabel("Déjà mis de côté").fill(p.depart);
  await d.getByLabel("Échéance").fill(p.echeance);
  await d.getByLabel("Priorité").selectOption({ label: p.priorite });
  await d.getByRole("button", { name: "Enregistrer" }).click();
  await expect(d).toBeHidden();
}

test.describe("projets : parcours principal", () => {
  test.skip(!url || !secret, raisonSaut);
  // Parcours long : une vingtaine d'écritures sur le vrai projet Supabase.
  test.setTimeout(120_000);

  test("3 projets, capacité insuffisante : manque, statuts, scénario testé puis appliqué", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);

      // Capacité d'épargne entrée à la main : 500 $
      await page.getByRole("link", { name: "Réglages" }).click();
      await page.getByLabel("Mode de calcul").selectOption("manuel");
      await page.getByLabel("Montant à la main (par mois)").fill("500");
      await page.getByRole("button", { name: "Enregistrer" }).click();
      await expect(page.getByText("Capacité d'épargne enregistrée.")).toBeVisible();

      // Les trois projets d'exemple du prototype
      await page.getByRole("link", { name: "Projets" }).click();
      await creerProjet(page, { nom: "Fonds d'urgence", cout: "5000", depart: "1200", echeance: "2027-09-04", priorite: "Haute" });
      const fonds = page.getByRole("article", { name: "Fonds d'urgence" });
      await fonds.getByLabel("Montant du versement").fill("300");
      await fonds.getByLabel("Date").fill("2026-10-03");
      await fonds.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(fonds.getByText("1 500 $ (30 %)")).toBeVisible();
      await creerProjet(page, { nom: "Formation professionnelle", cout: "3800", depart: "400", echeance: "2028-01-04", priorite: "Moyenne" });
      await creerProjet(page, { nom: "Ordinateur portable", cout: "1600", depart: "", echeance: "2027-05-04", priorite: "Basse" });

      // Statuts identiques au prototype
      await expect(fonds.getByText("Dans les temps")).toBeVisible();
      const formation = page.getByRole("article", { name: "Formation professionnelle" });
      await expect(formation.getByText("Sous-financé")).toBeVisible();
      await expect(formation.getByText("À ce rythme, objectif atteint vers octobre 2028, après l'échéance.")).toBeVisible();
      const ordi = page.getByRole("article", { name: "Ordinateur portable" });
      await expect(ordi.getByText("Non financé")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Épargne cumulée prévue, 24 mois" })).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);

      // Accueil : manque mensuel et projet le plus à risque
      await page.getByRole("link", { name: "Accueil" }).click();
      await expect(page.getByText("Manque mensuel")).toBeVisible();
      await expect(page.getByText("360 $").first()).toBeVisible();
      await expect(page.getByText("Projet le plus à risque")).toBeVisible();
      await expect(page.getByText("Il manque 360 $ par mois pour tenir toutes tes échéances.")).toBeVisible();
      await expect(page.getByText("Verse 350 $ dans « Fonds d'urgence » ce mois-ci.")).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);

      // Scénario testé puis fermé : rien ne change
      await page.getByRole("link", { name: "Tester un scénario" }).click();
      await page.getByLabel("Épargne mensuelle en plus (ou en moins, avec un signe −)").fill("400");
      await expect(page.getByText("Marge 40 $", { exact: true })).toBeVisible();
      await expect(page.getByText("Manque 360 $", { exact: true })).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);
      await page.getByRole("link", { name: "Fermer" }).click();
      await expect(page.getByRole("article", { name: "Ordinateur portable" }).getByText("Non financé")).toBeVisible();

      // Scénario appliqué : capacité 900 $, tous les projets dans les temps
      await page.getByRole("link", { name: "Tester un scénario" }).click();
      await page.getByLabel("Épargne mensuelle en plus (ou en moins, avec un signe −)").fill("400");
      await page.getByRole("button", { name: "Appliquer ce scénario" }).click();
      await expect(page).toHaveURL(/\/projets$/);
      // Next garde les pages déjà visitées dans le DOM, masquées : on ne compte que le visible.
      await expect(page.getByRole("article").getByText("Dans les temps").filter({ visible: true })).toHaveCount(3);
      await page.getByRole("link", { name: "Accueil" }).click();
      await expect(page.getByText("Marge mensuelle")).toBeVisible();
      await expect(page.getByText("900 $").first()).toBeVisible();
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
