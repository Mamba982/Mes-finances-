import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { accessible, sansTexteAnglais } from "./outils";
import { admin, connecterNouvelUtilisateur, raisonSaut, secret, supprimerUtilisateur, url } from "./session-outils";

const TABLES = ["profils", "categories", "regles_categorie", "imports", "transactions", "projets", "postes_projet", "versements", "factures", "comptes", "usage_ia"];

/** Données de départ créées directement en base (plus rapide que par l'interface). */
async function semer(id: string) {
  const a = admin();
  await a.from("profils").update({ mode_capacite: "manuel", capacite_manuelle: 500 }).eq("user_id", id);
  const { data: cat } = await a.from("categories").select("id").eq("user_id", id).eq("code", "epicerie").single();
  await a.from("transactions").insert({ user_id: id, date: "2026-10-05", libelle_brut: "MAXI #8812 QUEBEC", marchand: "Maxi Quebec", montant: -84.22, categorie_id: cat!.id, source: "manuel" });
  const { data: p } = await a.from("projets").insert({ user_id: id, nom: "Fonds d'urgence", cout: 5000, montant_depart: 1200, echeance: "2027-09-04", priorite: 1 }).select("id").single();
  await a.from("versements").insert({ user_id: id, projet_id: p!.id, montant: 300, date: "2026-10-03" });
  await a.from("comptes").insert({ user_id: id, nom: "CELI", type: "celi", solde: 2400 });
  await a.from("regles_categorie").insert({ user_id: id, motif: "maxi quebec", categorie_id: cat!.id, origine: "auto" });
}

async function telechargement(page: Page, nom: string): Promise<{ fichier: string; texte: string }> {
  const attente = page.waitForEvent("download");
  await page.getByRole("button", { name: nom }).click();
  const d = await attente;
  return { fichier: d.suggestedFilename(), texte: readFileSync((await d.path())!, "utf8") };
}

test.describe("livraison", () => {
  test.skip(!url || !secret, raisonSaut);
  test.setTimeout(120_000);

  test("installable : manifeste en français et icônes", async ({ page }) => {
    const r = await page.request.get("/manifest.webmanifest");
    expect(r.ok()).toBe(true);
    const m = await r.json();
    expect(m).toEqual(expect.objectContaining({ name: "Mes finances", lang: "fr-CA", start_url: "/accueil", display: "standalone" }));
    for (const i of m.icons) expect((await page.request.get(i.src)).ok()).toBe(true);
    expect((await page.request.get("/sw.js")).headers()["cache-control"]).toContain("no-cache");
  });

  test("export JSON complet et CSV ; consultation hors ligne après une visite", async ({ page, context }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-05:00"));
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await semer(id);
      await page.reload();
      await expect(page.getByText("500 $").first()).toBeVisible();

      // Export complet : toutes les tables, seulement les lignes de cet utilisateur
      await page.getByRole("link", { name: "Réglages" }).click();
      const json = await telechargement(page, "Tout télécharger (JSON)");
      expect(json.fichier).toBe("mes-finances-complet-2026-11-04.json");
      const contenu = JSON.parse(json.texte);
      expect(Object.keys(contenu.tables).sort()).toEqual([...TABLES].sort());
      expect(contenu.tables.transactions).toHaveLength(1);
      expect(contenu.tables.categories).toHaveLength(18);
      for (const t of TABLES) for (const l of contenu.tables[t]) expect(l.user_id).toBe(id);

      const csv = await telechargement(page, "Transactions (CSV)");
      expect(csv.texte).toBe("﻿Date;Description;Marchand;Montant;Catégorie;Déductible;TPS;TVQ;Source\r\n2026-10-05;MAXI #8812 QUEBEC;Maxi Quebec;-84,22;Épicerie;non;0,00;0,00;manuel\r\n");
      await sansTexteAnglais(page);
      await accessible(page);

      // Le service worker prend la main, puis l'accueil s'affiche hors ligne avec la copie locale
      await page.goto("/accueil");
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await page.waitForTimeout(1500); // la copie locale s'écrit après 1 s
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText(/^Hors ligne : données du /)).toBeVisible();
      await expect(page.getByText("500 $").first()).toBeVisible();
      await expect(page.getByText("Verse 350 $ dans « Fonds d'urgence » ce mois-ci.")).toBeVisible();
      await sansTexteAnglais(page);
      await context.setOffline(false);
    } finally {
      await supprimerUtilisateur(id);
    }
  });

  test("accueil en moins d'une seconde en 4G, à la visite suivante", async ({ page }) => {
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await semer(id);
      await page.reload();
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await page.waitForTimeout(1500);
      const cdp = await page.context().newCDPSession(page);
      // Profil « 4G lente » de Lighthouse : 150 ms d'aller-retour, 1,6 Mb/s en réception.
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      const debut = Date.now();
      await page.goto("/accueil");
      await expect(page.getByText("Épargne possible / mois")).toBeVisible();
      await expect(page.getByText("500 $").first()).toBeVisible();
      const duree = Date.now() - debut;
      console.log(`Accueil, visite suivante en 4G lente : ${duree} ms`);
      expect(duree).toBeLessThan(1000);
    } finally {
      await supprimerUtilisateur(id);
    }
  });

  test("suppression du compte : plus aucune ligne, plus aucune photo, plus d'utilisateur", async ({ page }) => {
    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      await semer(id);
      const a = admin();
      await a.storage.from("recus").upload(`${id}/recu.jpg`, new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }));

      await page.getByRole("link", { name: "Réglages" }).click();
      await page.getByLabel("Pour confirmer, tape SUPPRIMER").fill("supprimer");
      await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
      await expect(page.getByText("Tape SUPPRIMER en majuscules pour confirmer.")).toBeVisible();
      await page.getByLabel("Pour confirmer, tape SUPPRIMER").fill("SUPPRIMER");
      await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
      await expect(page).toHaveURL(/\/connexion\?compte=supprime/);
      await expect(page.getByText("Ton compte et toutes tes données ont été supprimés.")).toBeVisible();
      await sansTexteAnglais(page);

      for (const t of TABLES) {
        const { count } = await a.from(t).select("*", { count: "exact", head: true }).eq("user_id", id);
        expect(count, t).toBe(0);
      }
      const { data: fichiers } = await a.storage.from("recus").list(id);
      expect(fichiers).toEqual([]);
      const { data: u } = await a.auth.admin.getUserById(id);
      expect(u.user).toBeNull();
      // Plus de copie locale non plus
      const copies = await page.evaluate(
        () =>
          new Promise<number>((ok) => {
            const r = indexedDB.open("mes-finances", 1);
            r.onsuccess = () => {
              const c = r.result.transaction("instantanes").objectStore("instantanes").count();
              c.onsuccess = () => ok(c.result);
            };
            r.onerror = () => ok(0);
          }),
      );
      expect(copies).toBe(0);
      id = undefined;
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
