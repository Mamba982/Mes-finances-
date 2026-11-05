import { expect, test } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { admin, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

/**
 * Connexion par code (cas de Gmail sur iPhone, qui ouvre le lien dans son propre navigateur).
 * L'envoi du courriel est intercepté (aucun courriel réel, pas de limite d'envoi consommée) ;
 * le code vient de l'API d'administration et sa vérification passe par le vrai Supabase.
 */
test.describe("connexion par code", () => {
  test.skip(!url || !secret, raisonSaut);
  test.setTimeout(60_000);

  test("le code du courriel ouvre la session, même après un rechargement ; un mauvais code est refusé", async ({ page }) => {
    const a = admin();
    const courriel = `e2e-code-${Date.now()}-${Math.round(Math.random() * 1e6)}@exemple.ca`;
    const cree = await a.auth.admin.createUser({ email: courriel, email_confirm: true });
    expect(cree.error).toBeNull();
    const id = cree.data.user!.id;
    try {
      let envois = 0;
      await page.route("**/auth/v1/otp**", async (r) => {
        envois++;
        await r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });

      await page.goto("/connexion");
      await page.getByLabel("Courriel").fill(courriel);
      await page.getByRole("button", { name: "Recevoir le lien et le code" }).click();
      await expect(page.getByText(`Courriel envoyé à ${courriel}.`)).toBeVisible();
      expect(envois).toBe(1);
      const champ = page.getByLabel("Code reçu par courriel");
      await expect(champ).toHaveAttribute("autocomplete", "one-time-code");
      await expect(champ).toHaveAttribute("inputmode", "numeric");
      await sansTexteAnglais(page);
      await accessible(page);

      // iOS peut recharger l'application pendant la lecture du courriel : l'étape du code reste.
      await page.reload();
      await expect(champ).toBeVisible();

      // Saisie invalide : refusée sur place, sans appel réseau.
      await champ.fill("12ab");
      await page.getByRole("button", { name: "Me connecter" }).click();
      await expect(page.getByRole("status")).toHaveText("Entre le code reçu par courriel, en chiffres seulement.");

      // Mauvais code : refusé par Supabase, message en français.
      await champ.fill("000000");
      await page.getByRole("button", { name: "Me connecter" }).click();
      await expect(page.getByRole("status")).toHaveText(/Ce code est invalide ou expiré|Trop d'essais/);
      await sansTexteAnglais(page);

      // Bon code (espaces tolérés, comme après un copier-coller « 123 456 »).
      const lien = await a.auth.admin.generateLink({ type: "magiclink", email: courriel });
      expect(lien.error).toBeNull();
      const code = lien.data.properties!.email_otp;
      expect(code).toMatch(/^\d{6,10}$/);
      const moitie = Math.floor(code.length / 2);
      await champ.fill(`${code.slice(0, moitie)} ${code.slice(moitie)}`);
      await page.getByRole("button", { name: "Me connecter" }).click();
      await expect(page).toHaveURL(/\/accueil$/);
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("mes-finances:connexion-courriel"))).toBeNull();
    } finally {
      await supprimerUtilisateur(id);
    }
  });

  test("« J'ai déjà un code » mène au champ du code sans renvoyer de courriel", async ({ page }) => {
    let envois = 0;
    await page.route("**/auth/v1/otp**", async (r) => {
      envois++;
      await r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/connexion?erreur=lien");
    await expect(page.getByRole("status")).toContainText("Entre plutôt le code du courriel");
    await page.getByRole("button", { name: "J'ai déjà un code" }).click();
    await expect(page.getByRole("status")).toHaveText(/adresse courriel valide/);
    await page.getByLabel("Courriel").fill("nom@exemple.ca");
    await page.getByRole("button", { name: "J'ai déjà un code" }).click();
    await expect(page.getByLabel("Code reçu par courriel")).toBeVisible();
    expect(envois).toBe(0);
    await sansTexteAnglais(page);
  });
});
