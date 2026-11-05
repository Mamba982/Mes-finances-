import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { admin, connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

const RELEVE = join(import.meta.dirname, "../fixtures/releves/desjardins.csv");

test.describe("budget : parcours principal", () => {
  test.skip(!url || !secret, raisonSaut);
  test.use({ timezoneId: "America/Toronto" });

  test("nouveau compte → import CSV → dépenses classées et capacité calculée ; réimport sans doublon", async ({ page }) => {
    // Date figée : les relevés fictifs couvrent août à octobre 2026.
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    const debut = Date.now();
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);

      // Import du relevé Desjardins
      await page.getByRole("link", { name: "Budget" }).click();
      await page.getByRole("link", { name: "Importer un relevé" }).click();
      await page.getByLabel("Fichier CSV").setInputFiles(RELEVE);
      await expect(page.getByRole("heading", { name: "Vérifie avant d'importer" })).toBeVisible();
      await expect(page.getByText(/55 transactions lues \(CSV\)\. 1 doublon décoché\./)).toBeVisible();
      await sansTexteAnglais(page);
      await accessible(page);
      // Le second café identique est décoché par défaut ; l'utilisateur le garde (deux achats réels).
      const cafes = page.getByRole("checkbox", { name: /TIM HORTONS #2231, -12,50/ });
      await expect(cafes).toHaveCount(2);
      await cafes.nth(1).check();
      await page.getByRole("button", { name: "Importer 55 transactions" }).click();

      // Budget du mois importé
      await expect(page).toHaveURL(/\/budget\?mois=2026-08/);
      await expect(page.getByText("55 transactions importées.")).toBeVisible();
      await expect(page.getByText("Août 2026", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Transactions (17)" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Catégorie : Maxi Quebec" })).toHaveValue(/.+/);
      await sansTexteAnglais(page);
      await accessible(page);

      // Capacité d'épargne calculée sur août, septembre et octobre
      await page.getByRole("link", { name: "Accueil" }).click();
      await expect(page.getByText("1 051 $").first()).toBeVisible();
      await expect(page.getByText("moyenne de tes 3 derniers mois complets")).toBeVisible();
      expect(Date.now() - debut).toBeLessThan(3 * 60_000);

      // Réimport du même fichier : tout est signalé, rien n'entre
      await page.goto("/budget/importer");
      await page.getByLabel("Fichier CSV").setInputFiles(RELEVE);
      await expect(page.getByText(/55 transactions lues \(CSV\)\. 55 doublons décochés\./)).toBeVisible();
      await expect(page.getByRole("button", { name: "Importer 0 transaction" })).toBeDisabled();

      // Même en forçant toutes les lignes, la base refuse les doublons
      for (const c of await page.getByRole("checkbox").all()) await c.check();
      await page.getByRole("button", { name: "Importer 55 transactions" }).click();
      await expect(page.getByText("0 transaction importée, 55 écartées.")).toBeVisible();
      const { count } = await admin().from("transactions").select("id", { count: "exact", head: true }).eq("user_id", id);
      expect(count).toBe(55);
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
