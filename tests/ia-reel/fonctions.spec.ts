import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { coutUsd } from "@/ia/cout";
import { admin, connecterNouvelUtilisateur, secret, supprimerUtilisateur } from "../e2e/session-outils";

/**
 * Essais contre la vraie API à travers le déploiement : relevé PDF de 5 pages, reçu, assistant,
 * estimation de projet. Affiche durée, jetons et coût de chaque appel. Coût total d'un passage : environ 0,07 $ US.
 */
const FIXTURES = new URL("../fixtures/", import.meta.url).pathname;

async function journal(id: string, route: string) {
  const { data } = await admin().from("usage_ia").select("modele,jetons_entree,jetons_sortie,succes").eq("user_id", id).eq("route", route);
  expect(data, route).toHaveLength(1);
  const j = data![0]!;
  expect(j.succes).toBe(true);
  const cout = coutUsd(j.modele, j.jetons_entree, j.jetons_sortie)!;
  console.log(`${route} : ${j.modele}, ${j.jetons_entree} jetons en entrée, ${j.jetons_sortie} en sortie, ${cout.toFixed(4)} $ US`);
  return cout;
}

async function chrono<T>(nom: string, f: () => Promise<T>): Promise<T> {
  const debut = Date.now();
  const r = await f();
  console.log(`${nom} : ${Date.now() - debut} ms`);
  return r;
}

test.describe("fonctions de l'IA, vraie API", () => {
  test.skip(!process.env.IA_URL || !secret, "IA_URL ou SUPABASE_SECRET_KEY absent : essai réel non exécuté");

  test("relevé PDF, reçu, assistant et estimation", async ({ page, request }) => {
    test.skip(!(await (await request.get("/api/ia/etat")).json()).disponible, "IA non configurée sur le déploiement : essai réel non exécuté");
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      const a = admin();
      await a.from("profils").update({ ia_active: true, mode_capacite: "manuel", capacite_manuelle: 500 }).eq("user_id", id);
      await a.from("projets").insert([
        { user_id: id, nom: "Fonds d'urgence", cout: 5000, montant_depart: 1200, echeance: "2027-09-04", priorite: 1 },
        { user_id: id, nom: "Voyage au Portugal", cout: 4200, montant_depart: 0, echeance: "2027-06-01", priorite: 2 },
      ]);

      // 1. Relevé PDF de 5 pages : chaque ligne relue au cent près, puis écran de revue.
      const attendu: { libelle: string; montant: number }[] = JSON.parse(readFileSync(`${FIXTURES}releves/releve-5-pages.attendu.json`, "utf8"));
      await page.goto("/budget/importer");
      await chrono("Relevé PDF", async () => {
        await page.getByLabel(/Fichier du relevé/).setInputFiles(`${FIXTURES}releves/releve-5-pages.pdf`);
        await expect(page.getByRole("heading", { name: "Vérifie avant d'importer" })).toBeVisible({ timeout: 240_000 });
      });
      await expect(page.getByText(/Lu par l'IA : vérifie chaque date et chaque montant/)).toBeVisible();
      const lignes = await page.locator("ul.carte > li").evaluateAll((li) => li.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ")));
      expect(lignes).toHaveLength(attendu.length);
      const fmt = (c: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(c / 100).replace(/\s/g, " ");
      attendu.forEach((x, i) => {
        expect(lignes[i], `ligne ${i + 1}`).toContain(x.libelle);
        expect(lignes[i]!.replace(/\s/g, " "), `ligne ${i + 1}`).toContain(fmt(x.montant));
      });
      let total = await journal(id, "releve");

      // 2. Reçu : rappel avant l'envoi, formulaire prérempli.
      await page.goto("/affaires");
      await page.getByRole("button", { name: "Ajouter un reçu" }).first().click();
      await page.getByLabel("Photo du reçu (facultatif)").setInputFiles(`${FIXTURES}recus/recu-fictif.png`);
      await page.getByRole("button", { name: "Remplir avec l'IA" }).click();
      await expect(page.getByText(/Avant l'envoi : recadre ou cache/)).toBeVisible();
      await chrono("Reçu", async () => {
        await page.getByRole("button", { name: "Envoyer la photo à l'IA" }).click();
        await expect(page.getByText("Champs remplis par l'IA : vérifie chaque valeur avant d'ajouter.")).toBeVisible({ timeout: 90_000 });
      });
      const recu = JSON.parse(readFileSync(`${FIXTURES}recus/recu-fictif.attendu.json`, "utf8"));
      const valeur = (l: string) => page.getByLabel(l, { exact: true }).inputValue();
      expect(await valeur("Date")).toBe(recu.date);
      expect(await valeur("Total payé")).toBe("57,45");
      expect(await valeur("TPS")).toBe("2,50");
      expect(await valeur("TVQ")).toBe("4,98");
      total += await journal(id, "recu");

      // 3. Assistant : réponse tirée du résumé, sans nouveau chiffre.
      await page.goto("/assistant");
      await page.getByLabel("Ta question").fill("Est-ce que je peux tenir toutes mes échéances ?");
      await chrono("Assistant", async () => {
        await page.getByRole("button", { name: "Demander" }).click();
        await expect(page.getByRole("heading", { name: "Réponse" })).toBeVisible({ timeout: 90_000 });
      });
      console.log(await page.locator("section.carte p").first().textContent());
      total += await journal(id, "assistant");

      // 4. Estimation : postes en revue, montants = quantité × prix (domaine).
      await estimer(page);
      total += await journal(id, "estimation");
      console.log(`Total du passage : ${total.toFixed(4)} $ US`);
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});

async function estimer(page: Page) {
  await page.goto("/projets");
  const carte = page.locator("article").filter({ hasText: "Voyage au Portugal" });
  await carte.getByRole("button", { name: /Détail, versements et budget/ }).click();
  await carte.getByRole("button", { name: "Estimer les postes avec l'IA" }).click();
  await carte.getByLabel(/Décris ton projet/).fill("Deux semaines au Portugal en juin 2027 pour 2 adultes, départ de Montréal.");
  await chrono("Estimation", async () => {
    await carte.getByRole("button", { name: "Estimer", exact: true }).click();
    await expect(carte.getByText(/Estimation de l'IA, aux prix courants/)).toBeVisible({ timeout: 90_000 });
  });
  const n = await carte.locator("li").count();
  expect(n).toBeGreaterThanOrEqual(3);
  await carte.getByRole("button", { name: `Ajouter ${n} postes` }).click();
  await expect(carte.getByText("Total des postes")).toBeVisible();
}
