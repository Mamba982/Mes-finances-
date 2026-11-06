import { expect, test } from "@playwright/test";
import { categorieAuto } from "@/domaine/categorisation";
import { aujourdhuiLocal } from "@/domaine/dates";
import { coutUsd } from "@/ia/cout";
import { admin, connecterNouvelUtilisateur, secret, supprimerUtilisateur } from "../e2e/session-outils";

/** Libellés fictifs ; seuls ceux qu'aucune règle par défaut ne reconnaît sont envoyés à l'IA. */
const CANDIDATS: [string, number][] = [
  ["DOLLARAMA #1234 LAVAL", -1250],
  ["SAQ SELECTION 23045", -4899],
  ["JEAN COUTU 112", -2310],
  ["CANADIAN TIRE #321", -6745],
  ["RONA L'ENTREPOT", -12999],
  ["TIM HORTONS #4512", -485],
  ["STM CARTE OPUS", -9700],
  ["VIDEOTRON LTEE", -8500],
  ["PETRO-CANADA 8812", -6020],
  ["COSTCO WHOLESALE #503", -18744],
  ["SPOTIFY P1A2B3", -1199],
  ["CINEPLEX ODEON", -3200],
  ["INTACT ASSURANCE", -14210],
  ["GARDERIE LES PETITS POMMIERS", -18200],
  ["CLINIQUE DENTAIRE ROY", -21000],
  ["DEPOT PAIE EMPLOYEUR ABC INC", 214500],
  ["RETRAIT GAB 0012345678", -10000],
  ["VIREMENT CARTE 4520 1234 5678 9012", -50000],
  ["BOULANGERIE AU PAIN DORE", -875],
  ["MEC MOUNTAIN EQUIPMENT", -15999],
];

test.describe("catégorisation par la vraie API", () => {
  test.skip(!process.env.IA_URL || !secret, "IA_URL ou SUPABASE_SECRET_KEY absent : essai réel non exécuté");

  test("classe les transactions restantes, journalise les jetons, respecte réglage et limite", async ({ page, request }) => {
    const etat = await (await request.get("/api/ia/etat")).json();
    test.skip(!etat.disponible, "IA non configurée sur le déploiement (ANTHROPIC_API_KEY absente) : essai réel non exécuté");

    let id: string | undefined;
    try {
      id = await connecterNouvelUtilisateur(page);
      const a = admin();
      const lignes = CANDIDATS.filter(([l, m]) => categorieAuto(l, m) === null);
      expect(lignes.length, "assez de libellés inconnus des règles").toBeGreaterThanOrEqual(12);
      await a.from("transactions").insert(
        lignes.map(([libelle, m], i) => ({
          user_id: id,
          date: `2026-10-${String(i + 1).padStart(2, "0")}`,
          libelle_brut: libelle,
          marchand: libelle,
          montant: m / 100,
          source: "manuel",
        })),
      );

      // Réglage éteint (par défaut) : 403, aucun appel au modèle.
      const tx = (await a.from("transactions").select("id,date,libelle_brut,montant").eq("user_id", id)).data!;
      const corps = { transactions: tx.map((t) => ({ id: t.id, date: t.date, libelle: t.libelle_brut, montant: Math.round(Number(t.montant) * 100) })) };
      const refuse = await page.request.post("/api/ia/categoriser", { data: corps });
      expect(refuse.status()).toBe(403);
      expect((await refuse.json()).erreur).toBe("L'IA est désactivée dans tes réglages.");

      await a.from("profils").update({ ia_active: true }).eq("user_id", id);
      await page.goto("/budget");
      const debut = Date.now();
      await page.getByRole("button", { name: `Classer ${lignes.length} avec l'IA` }).click();
      await expect(page.getByText(/transactions? classées?\. Vérifie-les dans la liste\./)).toBeVisible({ timeout: 120_000 });
      const duree = Date.now() - debut;

      const cats = new Map((await a.from("categories").select("id,nom,type").eq("user_id", id)).data!.map((c) => [c.id, c]));
      const apres = (await a.from("transactions").select("libelle_brut,montant,categorie_id").eq("user_id", id)).data!;
      const classees = apres.filter((t) => t.categorie_id);
      console.log(`\nClassement (${duree} ms) :`);
      for (const t of apres) console.log(`  ${t.libelle_brut.padEnd(36)} ${String(t.montant).padStart(9)}  → ${cats.get(t.categorie_id)?.nom ?? "(non classée)"}`);
      expect(classees.length / apres.length, "part classée").toBeGreaterThanOrEqual(0.6);
      for (const t of classees) expect(cats.has(t.categorie_id!), "catégorie de l'utilisateur").toBe(true);
      // Cohérence de signe : une sortie d'argent n'est jamais classée en revenu.
      for (const t of classees) if (Number(t.montant) < 0) expect(cats.get(t.categorie_id!)!.type, t.libelle_brut).not.toBe("revenu");

      const journal = (await a.from("usage_ia").select("route,modele,jetons_entree,jetons_sortie,succes").eq("user_id", id)).data!;
      expect(journal).toHaveLength(1);
      const j = journal[0]!;
      expect(j).toMatchObject({ route: "categoriser", modele: "claude-haiku-5-5", succes: true });
      const cout = coutUsd(j.modele, j.jetons_entree, j.jetons_sortie)!;
      console.log(`Jetons : ${j.jetons_entree} en entrée, ${j.jetons_sortie} en sortie. Coût : ${cout.toFixed(5)} $ US`);
      expect(cout).toBeLessThan(0.01);

      // Limite du jour atteinte : 429 avec un message clair, aucun appel au modèle.
      const jour = aujourdhuiLocal();
      await a.from("usage_ia").insert(Array.from({ length: 30 }, () => ({ user_id: id, jour, route: "essai", modele: "aucun", succes: true })));
      const limite = await page.request.post("/api/ia/categoriser", { data: corps });
      expect(limite.status()).toBe(429);
      expect((await limite.json()).erreur).toBe(
        "Tu as utilisé tes 30 demandes à l'IA aujourd'hui. Réessaie demain. Tout le reste de l'application fonctionne sans l'IA.",
      );
    } finally {
      await supprimerUtilisateur(id);
    }
  });
});
