import { expect, test } from "@playwright/test";
import { capacite, indexer } from "@/domaine/budget";
import { projetAAfficher, repartir, type Projet } from "@/domaine/projets";
import { AUJOURDHUI, CATEGORIES, projetsExemple, transactionsReleves } from "../unitaires/aides";
import { ouvrirPrototype } from "./oracle";

/* eslint-disable @typescript-eslint/no-explicit-any -- l'oracle est le prototype en JavaScript sans types */
declare global {
  interface Window {
    __fin: any;
  }
}

/** Projets au format du prototype (dollars, « initial », « mouvements »). */
const versPrototype = (l: Projet[]) =>
  l.map((p) => ({
    id: p.id,
    nom: p.nom,
    cout: p.cout / 100,
    initial: p.montantDepart / 100,
    echeance: p.echeance,
    priorite: p.priorite,
    notes: p.notes ?? "",
    mouvements: p.versements.map((v) => ({ id: v.id, montant: v.montant / 100, date: v.date })),
    postes: [],
  }));

const STATUTS = { ok: "ok", retard: "retard", nonfinance: "nonfinance", atteint: "atteint", depasse: "depasse" } as const;

/** Exécute calcProjets dans le prototype et rend un résumé comparable (dollars → cents). */
async function oracle(page: import("@playwright/test").Page, projets: Projet[], cap: number | null, transactions: unknown[] = []) {
  return page.evaluate(
    ([pr, c, tx]) => {
      window.__fin.setState({ projets: pr }, tx);
      const S = window.__fin.getState().S;
      const r = c === null ? window.__fin.calcProjets(S) : window.__fin.calcProjets(S, c);
      const iso = (d: Date | undefined) =>
        d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
      return {
        cap: r.cap,
        ecart: r.ecart,
        marge: r.marge,
        totReq: r.tot.req,
        hz: r.hz,
        list: r.list.map((x: any) => ({ id: x.p.id, req: x.req, alloue: x.alloue, st: x.st, hz: x.hz, rest: x.rest, proj: iso(x.proj) })),
      };
    },
    [versPrototype(projets), cap === null ? null : cap / 100, transactions] as const,
  );
}

function comparer(o: Awaited<ReturnType<typeof oracle>>, projets: Projet[], cap: number) {
  const r = repartir(projets, cap, AUJOURDHUI);
  expect(r.capacite / 100).toBeCloseTo(o.cap, 6);
  expect(r.ecart / 100).toBeCloseTo(o.ecart, 6);
  expect(r.margeRestante / 100).toBeCloseTo(o.marge, 6);
  expect(r.totaux.requis / 100).toBeCloseTo(o.totReq, 6);
  r.projets.forEach((x, i) => {
    const y = o.list[i]!;
    expect(x.projet.id).toBe(y.id);
    expect(x.statut, `statut de ${x.projet.nom}`).toBe(STATUTS[y.st as keyof typeof STATUTS]);
    expect(x.requis / 100).toBeCloseTo(y.req, 6);
    expect(x.alloue / 100).toBeCloseTo(y.alloue, 6);
    expect(x.reste / 100).toBeCloseTo(y.rest, 6);
    expect(x.horizon).toBe(y.hz);
    expect(x.atteinteProjetee).toBe(y.proj);
  });
  for (const h of ["court", "moyen", "long"] as const) {
    expect(r.parHorizon[h].nombre).toBe(o.hz[h].n);
    expect(r.parHorizon[h].requis / 100).toBeCloseTo(o.hz[h].req, 6);
  }
  return r;
}

test.describe("parité avec le prototype : projets", () => {
  test.beforeEach(async ({ page }) => ouvrirPrototype(page, AUJOURDHUI));

  test("critère d'acceptation : 3 projets, capacité insuffisante → même manque et mêmes statuts", async ({ page }) => {
    const p = projetsExemple();
    const r = comparer(await oracle(page, p, 50000), p, 50000);
    expect(r.ecart).toBeLessThan(0);
    expect(r.projets.map((x) => x.statut)).toEqual(["ok", "retard", "nonfinance"]);
  });

  for (const cap of [0, 1, 30000, 35000, 59952, 85952, 85902, 100000, 500000]) {
    test(`capacité ${cap / 100} $`, async ({ page }) => {
      comparer(await oracle(page, projetsExemple(), cap), projetsExemple(), cap);
    });
  }

  test("priorités égales, échéance dépassée, objectif atteint, retrait", async ({ page }) => {
    const [a, b, c] = projetsExemple();
    const l: Projet[] = [
      { ...a!, priorite: 2 },
      { ...b!, echeance: "2026-09-30" },
      { ...c!, priorite: 2, montantDepart: 170000, versements: [{ id: "r", montant: -20000, date: "2026-10-01", note: null }] },
      { ...c!, id: "p4", nom: "Vélo", cout: 90000, montantDepart: 95000, echeance: "2032-06-01", priorite: 1 },
      { ...c!, id: "p5", nom: "Voyage", cout: 400000, echeance: "2026-11-28", priorite: 3 },
    ];
    for (const cap of [20000, 120000, 400000]) comparer(await oracle(page, l, cap), l, cap);
  });

  test("capacité automatique tirée des relevés, projets trop chers pour elle", async ({ page }) => {
    const l = projetsExemple().map((p) => ({ ...p, cout: p.cout * 2 }));
    const tx = transactionsReleves().map((t) => ({
      id: t.id, date: t.date, libelle: t.libelle, marchand: t.marchand, montant: t.montant / 100, categorie: t.categorieId,
    }));
    const o = await oracle(page, l, null, tx);
    const cap = capacite({ mode: "auto", manuelle: 0 }, transactionsReleves(), indexer(CATEGORIES), AUJOURDHUI).valeur;
    const r = comparer(o, l, cap);
    expect(r.ecart).toBeLessThan(0);
    expect(projetAAfficher(r)?.aRisque).toBe(true);
  });
});
