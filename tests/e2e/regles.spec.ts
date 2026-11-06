import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { admin, connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

const csv = (lignes: string[]) => ({ name: "releve.csv", mimeType: "text/csv", buffer: Buffer.from(["Date,Description,Montant", ...lignes].join("\n")) });

test.describe("classement par règles, sans IA", () => {
  test.skip(!url || !secret, raisonSaut);
  test.setTimeout(120_000);

  test("une correction retient une règle ; règle ajoutée ; nouvel import classé ; IA indisponible sans clé", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      const aClasser = async () =>
        (await admin().from("transactions").select("id", { count: "exact", head: true }).eq("user_id", id).is("categorie_id", null)).count;

      // Import : trois marchands inconnus des règles par défaut
      await page.goto("/budget/importer");
      await page.getByLabel("Fichier CSV").setInputFiles(
        csv(["2026-09-15,GARDERIE LES PETITS LOUPS,-450.00", "2026-10-15,GARDERIE LES PETITS LOUPS,-450.00", "2026-10-20,RONA 123 QUEBEC,-38.50"]),
      );
      await page.getByRole("button", { name: "Importer 3 transactions" }).click();
      await expect(page).toHaveURL(/\/budget\?mois=2026-09/);
      expect(await aClasser()).toBe(3);

      // Correction en septembre : la règle « garderie les petits » est retenue, l'autre garderie peut suivre
      await page.getByRole("combobox", { name: "Catégorie : Garderie Les Petits" }).selectOption({ label: "Autres dépenses" });
      await expect(page.getByText("Règle retenue : « garderie les petits » → Autres dépenses.", { exact: false })).toBeVisible();
      await page.getByRole("button", { name: "Classer aussi l'autre transaction à classer" }).click();
      await expect.poll(aClasser).toBe(1);
      await sansTexteAnglais(page);
      await accessible(page);

      // Règle ajoutée à la main, puis appliquée aux transactions à classer
      await page.getByRole("link", { name: "Règles de classement" }).click();
      await expect(page.getByRole("paragraph").filter({ hasText: "« garderie les petits »" }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText("retenue", { exact: true })).toBeVisible();
      await page.getByLabel("Mot-clé").fill("Rona");
      await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Achats" });
      await page.getByRole("button", { name: "Ajouter la règle" }).click();
      await expect(page.getByRole("button", { name: "Supprimer « rona »" })).toBeVisible();
      await page.getByRole("button", { name: "Classer 1 transaction à classer avec les règles" }).click();
      await expect(page.getByText("1 transaction classée.")).toBeVisible();
      expect(await aClasser()).toBe(0);
      await sansTexteAnglais(page);
      await accessible(page);

      // Nouvel import : la règle retenue propose la bonne catégorie à la revue
      await page.goto("/budget/importer");
      await page.getByLabel("Fichier CSV").setInputFiles(csv(["2026-11-01,GARDERIE LES PETITS LOUPS #2,-450.00"]));
      await expect(page.getByRole("combobox", { name: /Catégorie : GARDERIE LES PETITS LOUPS #2/ })).toHaveValue(
        (await admin().from("categories").select("id").eq("user_id", id).eq("code", "autres").single()).data!.id,
      );

      // IA : non configurée sur ce serveur, réglage grisé, routes fermées sans appel externe
      await page.goto("/reglages");
      await expect(page.getByText(/L'IA n'est pas configurée sur ce serveur/)).toBeVisible();
      await expect(page.getByLabel("Utiliser l'IA (facultatif)")).toBeDisabled();
      await sansTexteAnglais(page);
      await accessible(page);
      expect(await (await page.request.get("/api/ia/etat")).json()).toEqual({ disponible: false });
      const r = await page.request.post("/api/ia/categoriser", { data: { transactions: [] } });
      expect(r.status()).toBe(503);
      expect(await r.json()).toEqual({ erreur: "L'IA n'est pas disponible sur ce serveur." });
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
