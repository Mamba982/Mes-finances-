import { expect, test } from "@playwright/test";
import { lireMontant } from "@/domaine/argent";
import { indexer, type Transaction } from "@/domaine/budget";
import { etatResultats, fraisCarte, taxes, type Facture } from "@/domaine/factures";
import { AUJOURDHUI, CATEGORIES } from "../unitaires/aides";
import { ouvrirPrototype } from "./oracle";

/* eslint-disable @typescript-eslint/no-explicit-any -- l'oracle est le prototype en JavaScript sans types */
declare global {
  interface Window {
    __fin: any;
  }
}

/** Factures et dépenses déductibles de l'exemple du prototype, plus des cas d'arrondi. */
const FACTURES = [
  { id: "f1", no: "F-2026-001", client: "Restaurant Le Baobab", description: "Traiteur", montant: 750, taxes: true, date: "2026-09-20", echeance: "2026-10-20", statut: "payee", payeeLe: "2026-10-15" },
  { id: "f2", no: "F-2026-002", client: "Événements Kasaï", description: "Décoration", montant: 1200, taxes: true, date: "2026-09-25", echeance: "2026-10-25", statut: "envoyee" },
  { id: "f3", no: "F-2026-003", client: "Association", description: "Animation", montant: 333.33, taxes: true, date: "2026-10-01", echeance: "2026-10-31", statut: "payee", payeeLe: "2026-10-02" },
  { id: "f4", no: "F-2026-004", client: "Particulier", description: "Atelier", montant: 199.99, taxes: false, date: "2026-10-05", echeance: "2026-11-05", statut: "payee", payeeLe: "2026-10-06" },
];
const DEDUCTIBLES = [
  { id: "t1", date: "2026-09-19", libelle: "BUREAU EN GROS 112", montant: -45.99, categorie: "affaires", deductible: true, tps: 2, tvq: 3.99 },
  { id: "t2", date: "2026-10-25", libelle: "ESSO 3321 LIVRAISON CLIENT", montant: -48, categorie: "affaires", deductible: true, tps: 2.09, tvq: 4.17 },
  { id: "t3", date: "2026-10-26", libelle: "QUINCAILLERIE", montant: -20, categorie: null, deductible: true },
];

const versNous = (): { factures: Facture[]; transactions: Transaction[] } => ({
  factures: FACTURES.map((f) => {
    const ht = Math.round(f.montant * 100);
    return {
      id: f.id, numero: f.no, client: f.client, courriel: null, description: f.description, montantHt: ht, taxable: f.taxes,
      tauxTps: 5, tauxTvq: 9.975, ...taxes(ht, f.taxes, 5, 9.975), date: f.date, echeance: f.echeance,
      statut: f.statut as Facture["statut"], datePaiement: f.payeeLe ?? null,
    };
  }),
  transactions: DEDUCTIBLES.map((t) => ({
    id: t.id, date: t.date, libelle: t.libelle, marchand: t.libelle, montant: Math.round(t.montant * 100), categorieId: t.categorie,
    deductible: true, tps: Math.round((t.tps ?? 0) * 100), tvq: Math.round((t.tvq ?? 0) * 100),
  })),
});

const lire = (s: string) => Math.abs(lireMontant(s.replace(/[−−]/g, "-")) ?? NaN);

test.describe("parité avec le prototype : affaires", () => {
  test.beforeEach(async ({ page }) => ouvrirPrototype(page, AUJOURDHUI));

  test("état des résultats 2026 identique (revenus, dépenses, bénéfice, taxes nettes)", async ({ page }) => {
    await page.evaluate(([f, t]) => {
      window.__fin.setState({ factures: f }, t);
      location.hash = "#affaires";
    }, [FACTURES, DEDUCTIBLES] as const);
    const ligne = (libelle: string) => page.locator("tr", { hasText: libelle }).first().locator("td.n");
    const proto = {
      revenus: lire(await ligne("Revenus encaissés (avant taxes)").innerText()),
      depenses: lire(await ligne("Dépenses déductibles (avant taxes)").innerText()),
      benefice: lire(await ligne("Bénéfice estimé").innerText()),
      tps: lire(await ligne("TPS perçue").innerText()),
      cti: lire(await ligne("TPS payée sur tes achats (CTI)").innerText()),
      tvq: lire(await ligne("TVQ perçue").innerText()),
      rti: lire(await ligne("TVQ payée sur tes achats (RTI)").innerText()),
      net: lire(await ligne("Taxes nettes à remettre (estimation)").innerText()),
    };
    const { factures, transactions } = versNous();
    const e = etatResultats(factures, transactions, indexer(CATEGORIES), 2026, "À classer");
    expect({
      revenus: e.revenus, depenses: e.depenses, benefice: e.benefice, tps: e.tpsPercue, cti: e.cti, tvq: e.tvqPercue, rti: e.rti, net: e.taxesNettes,
    }).toEqual(proto);
  });

  test("frais d'un paiement par carte identiques", async ({ page }) => {
    const montants = [0, 1, 99, 1500, 86231, 33333, 1999999, 12345];
    const proto: number[] = await page.evaluate((m) => {
      window.__fin.setState({}, []);
      return m.map((c) => window.__fin.fraisCarte(c / 100));
    }, montants);
    expect(montants.map((c) => fraisCarte(c, 2.9, 25))).toEqual(proto.map((d) => Math.round(d * 100)));
  });
});
