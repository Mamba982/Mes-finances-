import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { capacite, indexer } from "@/domaine/budget";
import { categorieAuto } from "@/domaine/categorisation";
import { marquerDoublons } from "@/domaine/doublons";
import { radar } from "@/domaine/radar";
import { lireCsv } from "@/import/csv/lire";
import { CATEGORIES, RELEVES, transactionsReleves } from "../unitaires/aides";
import { ouvrirPrototype, type TxPrototype } from "./oracle";

/* eslint-disable @typescript-eslint/no-explicit-any -- l'oracle est le prototype en JavaScript sans types */
declare global {
  interface Window {
    __fin: any;
  }
}

const AUJOURDHUI = "2026-11-04";
const versPrototype = (): TxPrototype[] =>
  transactionsReleves().map((t) => ({ id: t.id, date: t.date, libelle: t.libelle, marchand: t.marchand, montant: t.montant / 100, categorie: t.categorieId }));

test.describe("parité avec le prototype : budget", () => {
  test.beforeEach(async ({ page }) => ouvrirPrototype(page, AUJOURDHUI));

  for (const fichier of readdirSync(RELEVES).filter((f) => f.endsWith(".csv"))) {
    test(`lecture CSV identique : ${fichier}`, async ({ page }) => {
      const texte = readFileSync(join(RELEVES, fichier), "utf8");
      const proto: { date: string; libelle: string; montant: number }[] = await page.evaluate((t) => window.__fin.parseCSV(t), texte);
      const nous = lireCsv(texte).lignes;
      expect(nous.map((l) => [l.date, l.libelle, l.montant])).toEqual(proto.map((l) => [l.date, l.libelle, Math.round(l.montant * 100)]));
    });
  }

  test("classement automatique identique", async ({ page }) => {
    const cas = transactionsReleves()
      .map((t) => [t.libelle, t.montant] as const)
      .concat([["UBER EATS", -2500], ["UBER TRIP", -1800], ["VIREMENT DEPUIS EPARGNE", 30000], ["QUINCAILLERIE", -100], ["REMBOURSEMENT", 500]]);
    const proto: (string | null)[] = await page.evaluate((c) => c.map(([l, m]) => window.__fin.autoCat(l, m / 100)), cas);
    expect(cas.map(([l, m]) => categorieAuto(l, m))).toEqual(proto);
  });

  test("doublons identiques (réimport, chevauchement, doublon probable)", async ({ page }) => {
    const base = transactionsReleves().filter((t) => t.date < "2026-10-15");
    const lignes = transactionsReleves()
      .filter((t) => t.date >= "2026-10-01")
      .map((t) => ({ date: t.date, libelle: t.libelle, montant: t.montant }))
      .concat([
        { date: "2026-10-06", libelle: "MAXI 8812 QC", montant: -9700 },
        { date: "2026-10-09", libelle: "ACHAT MAXI QUEBEC", montant: -9700 },
      ]);
    const proto: (string | null)[] = await page.evaluate(
      ([l, b]) =>
        window.__fin
          .marquerDoublons(
            l.map((x: any) => ({ ...x, montant: x.montant / 100 })),
            b.map((x: any) => ({ ...x, montant: x.montant / 100 })),
          )
          .map((r: any) => r.dup),
      [lignes, base] as const,
    );
    const nous = marquerDoublons(lignes, base);
    expect(nous).toEqual(proto);
    expect(nous.filter((s) => s === "probable").length).toBeGreaterThan(0);
  });

  test("radar à frais et paiements récurrents identiques", async ({ page }) => {
    const proto = await page.evaluate((t) => {
      window.__fin.setState({}, t);
      const r = window.__fin.radar();
      return { totFrais: r.totFrais, parType: r.parType, abos: r.abos, totAbos: r.totAbos };
    }, versPrototype());
    const nous = radar(transactionsReleves(), indexer(CATEGORIES), AUJOURDHUI);
    expect(nous.totalFrais).toBe(Math.round(proto.totFrais * 100));
    expect(Object.fromEntries(Object.entries(nous.parType))).toEqual(
      Object.fromEntries(Object.entries(proto.parType as Record<string, number>).map(([k, v]) => [k, Math.round(v * 100)])),
    );
    expect(nous.recurrents.map((r) => [r.nom, r.nbMois, Math.round(r.mensuel)])).toEqual(
      (proto.abos as any[]).map((a) => [a.nom, a.mois, Math.round(a.mensuel * 100)]),
    );
  });

  test("capacité d'épargne automatique identique", async ({ page }) => {
    const cap: number = await page.evaluate((t) => {
      window.__fin.setState({}, t);
      return window.__fin.calcProjets(window.__fin.getState().S).cap;
    }, versPrototype());
    const nous = capacite({ mode: "auto", manuelle: 0 }, transactionsReleves(), indexer(CATEGORIES), AUJOURDHUI);
    expect(nous.source).toBe("auto");
    expect(nous.valeur / 100).toBeCloseTo(cap, 6);
  });
});
