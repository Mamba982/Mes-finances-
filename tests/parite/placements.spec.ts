import { expect, test } from "@playwright/test";
import { formaterMontant, lireMontant } from "@/domaine/argent";
import { coutChange, croissance, enveloppe, patrimoine } from "@/domaine/placements";
import { repartir } from "@/domaine/projets";
import { T } from "@/textes/fr-CA";
import { AUJOURDHUI, projetsExemple } from "../unitaires/aides";
import { ouvrirPrototype } from "./oracle";

/* eslint-disable @typescript-eslint/no-explicit-any -- l'oracle est le prototype en JavaScript sans types */
declare global {
  interface Window {
    __fin: any;
  }
}

test.describe("parité avec le prototype : placements", () => {
  test.beforeEach(async ({ page }) => ouvrirPrototype(page, AUJOURDHUI));

  const CAS = [
    [1000, 200, 5, 2, 10],
    [0, 500, 7, 0.25, 30],
    [25000, 0, 4, 1.5, 2.5],
    [1000, 200, 0, 0, 1],
    [5000, 100, 3, 3, 50],
    [100, 10, 6, 2.2, 0.1],
  ] as const;

  test("simulateur de croissance identique (valeur finale, sans frais, total versé, points)", async ({ page }) => {
    const proto: any[] = await page.evaluate((cas) => cas.map((c) => window.__fin.croissance(...c)), CAS);
    CAS.forEach(([ini, mens, taux, frais, ans], i) => {
      const nous = croissance(ini * 100, mens * 100, taux, frais, ans);
      const p = proto[i];
      expect(nous.valeurFinale / 100).toBeCloseTo(p.final, 6);
      expect(nous.valeurSansFrais / 100).toBeCloseTo(p.final0, 6);
      expect(nous.totalVerse / 100).toBeCloseTo(p.verse, 6);
      expect(nous.points.map((x) => x / 100)).toHaveLength(p.pts.length);
      nous.points.forEach((x, j) => expect(x / 100).toBeCloseTo(p.pts[j], 6));
    });
  });

  test("avoir net et type de compte suggéré par projet identiques (onglet Placements)", async ({ page }) => {
    const projets = [
      ...projetsExemple(),
      { ...projetsExemple()[0]!, id: "p4", nom: "Mise de fonds condo", echeance: "2030-06-01" },
      { ...projetsExemple()[0]!, id: "p5", nom: "Études des enfants", echeance: "2040-09-01" },
      { ...projetsExemple()[0]!, id: "p6", nom: "Retraite anticipée", echeance: "2036-01-01" },
      { ...projetsExemple()[0]!, id: "p7", nom: "Voyage au Japon", echeance: "2029-03-01" },
    ];
    await page.evaluate((pr) => {
      window.__fin.setState(
        {
          projets: pr.map((p: any) => ({ id: p.id, nom: p.nom, cout: p.cout / 100, initial: 0, echeance: p.echeance, priorite: p.priorite, mouvements: [], postes: [] })),
          comptes: [
            { id: "c1", nom: "CELI", type: "CELI", solde: 2400 },
            { id: "c2", nom: "Compte épargne", type: "Épargne", solde: 1200 },
            { id: "c3", nom: "Carte de crédit", type: "Dette", solde: 640 },
          ],
        },
        [],
      );
      location.hash = "#placements";
    }, projets);
    const kpi = async (l: string) => lireMontant((await page.locator(".kpi", { has: page.locator(".l", { hasText: l }) }).first().locator(".v").innerText()).replace(/\s/g, ""));
    const nous = patrimoine([
      { id: "c1", nom: "CELI", type: "celi", solde: 240000, majLe: AUJOURDHUI },
      { id: "c2", nom: "Compte épargne", type: "epargne", solde: 120000, majLe: AUJOURDHUI },
      { id: "c3", nom: "Carte de crédit", type: "dette", solde: 64000, majLe: AUJOURDHUI },
    ]);
    expect(await kpi("Actifs")).toBe(nous.actifs);
    expect(await kpi("Dettes")).toBe(nous.dettes);
    expect(await kpi("Avoir net")).toBe(nous.net);

    const r = repartir(projets, 0, AUJOURDHUI);
    for (const x of r.projets) {
      const carte = page.locator(".card", { has: page.locator("b", { hasText: x.projet.nom }) });
      const titreProto = await carte.locator("div[style*='font-weight:600']").innerText();
      expect(titreProto, x.projet.nom).toBe(T.placements.enveloppes[enveloppe(x)][0]);
      expect(await carte.locator(".note").innerText()).toBe(T.placements.enveloppes[enveloppe(x)][1]);
    }
  });

  test("calculateur de frais de change identique (5 000 $ par mois, 1,5 %, compte US à 10 $)", async ({ page }) => {
    await page.evaluate(() => {
      window.__fin.setState({}, []);
      location.hash = "#placements";
    });
    const texte = (await page.locator("#calc-c").innerText()).replace(/[\u00a0\u202f]/g, " ");
    const c = coutChange(500000, 1.5, 1000);
    const n = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
    expect(texte).toContain(n(formaterMontant(c.allerMensuel, 2)));
    expect(texte).toContain(n(formaterMontant(c.allerRetourMensuel, 2)));
    expect(texte).toContain(`sur un an : ${n(formaterMontant(c.allerRetourAnnuel, 0))}`);
    expect(texte).toContain(c.compteUsRentable ? "Rentable" : "Pas rentable");
    expect(texte).toContain(`rentable au-delà de ${n(formaterMontant(c.seuilRentabilite, 0))} convertis par mois`);
  });
});
