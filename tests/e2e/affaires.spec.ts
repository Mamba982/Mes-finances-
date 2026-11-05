import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { admin, connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

test.describe("affaires : parcours principal", () => {
  test.skip(!url || !secret, raisonSaut);
  test.setTimeout(120_000);

  test("facture payée → un seul revenu ; reçu avec photo ; état des résultats", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await page.getByRole("link", { name: "Affaires" }).click();
      await expect(page.getByText("Aucune facture.")).toBeVisible();

      // Nouvelle facture envoyée : 750 $ + TPS + TVQ = 862,31 $
      await page.getByRole("button", { name: "Nouvelle facture" }).click();
      const d = page.getByRole("dialog", { name: "Nouvelle facture" });
      await expect(d.getByText("Numéro attribué à l'enregistrement : F-2026-001")).toBeVisible();
      await d.getByLabel("Client", { exact: true }).fill("Restaurant Le Baobab");
      await d.getByLabel("Description du service").fill("Service de traiteur, 40 personnes");
      await d.getByLabel("Montant avant taxes").fill("750");
      await d.getByLabel("Statut").selectOption({ label: "Envoyée" });
      await sansTexteAnglais(page);
      await accessible(page);
      await d.getByRole("button", { name: "Enregistrer" }).click();
      await expect(d).toBeHidden();
      await expect(page.getByText("862,31 $").first()).toBeVisible();
      await expect(page.getByText("carte : −25,26 $")).toBeVisible();

      // Payée deux fois de suite (double clic) : un seul revenu
      await page.getByRole("button", { name: "Ouvrir F-2026-001" }).click();
      const f = page.getByRole("dialog", { name: "Facture F-2026-001" });
      await f.getByLabel("Statut").selectOption({ label: "Payée" });
      await expect(f.getByLabel("Date du paiement")).toHaveValue("2026-11-04");
      await f.getByRole("button", { name: "Enregistrer" }).dblclick();
      await expect(f).toBeHidden();
      await expect(page.getByText("Payée", { exact: true })).toBeVisible();
      const { data: revenus } = await admin().from("transactions").select("montant, source").eq("user_id", id).eq("source", "facture");
      expect(revenus).toEqual([{ montant: 862.31, source: "facture" }]);

      // Une facture payée n'est plus modifiable
      await page.getByRole("button", { name: "Ouvrir F-2026-001" }).click();
      await expect(f.getByText(/Payée le 4 nov\. 2026/)).toBeVisible();
      await expect(f.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
      await f.getByRole("button", { name: "Fermer" }).click();

      // Reçu avec photo (image générée pour le test)
      const photo = await page.screenshot({ type: "jpeg", quality: 60 });
      await page.getByRole("button", { name: "Ajouter un reçu" }).click();
      const r = page.getByRole("dialog", { name: "Ajouter un reçu" });
      await r.getByLabel("Photo du reçu (facultatif)").setInputFiles({ name: "recu.jpg", mimeType: "image/jpeg", buffer: photo });
      await r.getByLabel("Marchand").fill("Bureau en gros");
      await r.getByLabel("Total payé").fill("45,99");
      await r.getByLabel("TPS", { exact: true }).fill("2");
      await r.getByLabel("TVQ", { exact: true }).fill("3,99");
      await r.getByRole("button", { name: "Ajouter comme dépense déductible" }).click();
      await expect(r).toBeHidden();

      // État des résultats 2026 : 750 $ − 40 $ ; taxes nettes (37,50 − 2) + (74,81 − 3,99) = 106,32 $
      await expect(page.getByRole("row", { name: /Revenus encaissés \(avant taxes\) 750,00 \$/ })).toBeVisible();
      await expect(page.getByRole("row", { name: /Dépenses déductibles \(avant taxes\) −40,00 \$/ })).toBeVisible();
      await expect(page.getByRole("row", { name: /Bénéfice estimé 710,00 \$/ })).toBeVisible();
      await expect(page.getByRole("row", { name: /Taxes nettes à remettre \(estimation\) 106,32 \$/ })).toBeVisible();

      // La photo est privée et s'affiche par un lien temporaire
      await page.getByRole("button", { name: /Voir la photo Bureau en gros/ }).click();
      const img = page.getByRole("img", { name: /Photo du reçu : Bureau en gros/ });
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Fermer" }).click();
      await sansTexteAnglais(page);
      await accessible(page);
    } finally {
      if (id) {
        const { data } = await admin().storage.from("recus").list(id);
        if (data?.length) await admin().storage.from("recus").remove(data.map((o) => `${id}/${o.name}`));
      }
      await supprimerUtilisateur(id);
    }
  });
});
