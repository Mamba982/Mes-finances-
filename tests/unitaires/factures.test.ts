import { describe, expect, it } from "vitest";
import { indexer, type Transaction } from "@/domaine/budget";
import {
  coutEncaissement,
  etatResultats,
  fraisCarte,
  joursDeRetard,
  prochainNumero,
  resumeFactures,
  statutAffiche,
  taxes,
  type Facture,
} from "@/domaine/factures";
import { CATEGORIES } from "./aides";

const facture = (x: Partial<Facture>): Facture => ({
  id: "f",
  numero: "F-2026-001",
  client: "Restaurant Le Baobab",
  courriel: null,
  description: "Service de traiteur, 40 personnes",
  montantHt: 75000,
  taxable: true,
  tauxTps: 5,
  tauxTvq: 9.975,
  ...taxes(x.montantHt ?? 75000, x.taxable ?? true, 5, 9.975),
  date: "2026-09-20",
  echeance: "2026-10-20",
  statut: "brouillon",
  datePaiement: null,
  ...x,
});

describe("numéros de facture", () => {
  it("F-AAAA-NNN : plus grand numéro de l'année + 1", () => {
    expect(prochainNumero([], 2026)).toBe("F-2026-001");
    expect(prochainNumero(["F-2026-001", "F-2026-007", "F-2025-042"], 2026)).toBe("F-2026-008");
    expect(prochainNumero(["F-2025-042"], 2026)).toBe("F-2026-001");
  });
  it("au-delà de 999, le numéro s'allonge", () => {
    expect(prochainNumero(["F-2026-999"], 2026)).toBe("F-2026-1000");
  });
});

describe("taxes", () => {
  it("750 $ : TPS 37,50 $, TVQ 74,81 $, total 862,31 $", () => {
    expect(taxes(75000, true, 5, 9.975)).toEqual({ tps: 3750, tvq: 7481, total: 86231 });
  });
  it("facture non taxable : aucune taxe", () => {
    expect(taxes(75000, false, 5, 9.975)).toEqual({ tps: 0, tvq: 0, total: 75000 });
  });
  it("taux modifiables", () => {
    expect(taxes(10000, true, 5, 0)).toEqual({ tps: 500, tvq: 0, total: 10500 });
  });
});

describe("statut affiché", () => {
  it("envoyée et échéance passée : en retard", () => {
    expect(statutAffiche({ statut: "envoyee", echeance: "2026-10-25" }, "2026-11-04")).toBe("retard");
    expect(statutAffiche({ statut: "envoyee", echeance: "2026-11-04" }, "2026-11-04")).toBe("envoyee");
    expect(statutAffiche({ statut: "payee", echeance: "2026-10-01" }, "2026-11-04")).toBe("payee");
    expect(statutAffiche({ statut: "brouillon", echeance: "2026-10-01" }, "2026-11-04")).toBe("brouillon");
  });
  it("jours de retard", () => {
    expect(joursDeRetard({ echeance: "2026-10-25" }, "2026-11-04")).toBe(10);
  });
  it("à recevoir = envoyées + en retard, TTC", () => {
    const l = [
      facture({ statut: "envoyee", echeance: "2026-12-01" }),
      facture({ statut: "envoyee", echeance: "2026-10-01" }),
      facture({ statut: "payee", datePaiement: "2026-10-15" }),
      facture({ statut: "brouillon" }),
    ];
    expect(resumeFactures(l, "2026-11-04")).toEqual({ aRecevoir: 2 * 86231, enRetard: 86231 });
  });
});

describe("coût de l'encaissement", () => {
  it("carte : 2,9 % + 0,25 $", () => {
    expect(fraisCarte(86231, 2.9, 25)).toBe(2526);
  });
  it("1 500 $ : 43,75 $ par carte, écart faible", () => {
    expect(coutEncaissement(150000, { cartePct: 2.9, carteFixe: 25, interac: 0 })).toEqual({
      carte: 4375,
      interac: 0,
      difference: 4375,
      conseillerVirement: false,
    });
  });
  it("au-delà de 50 $ d'écart, on conseille un virement", () => {
    expect(coutEncaissement(200000, { cartePct: 2.9, carteFixe: 25, interac: 0 }).conseillerVirement).toBe(true);
    expect(coutEncaissement(200000, { cartePct: 2.9, carteFixe: 25, interac: 1000 }).conseillerVirement).toBe(false);
  });
});

describe("état des résultats", () => {
  const tx = (date: string, montant: number, tps: number, tvq: number, categorieId: string | null, deductible = true): Transaction => ({
    id: date + montant,
    date,
    libelle: "x",
    marchand: "X",
    montant,
    categorieId,
    deductible,
    tps,
    tvq,
  });
  const factures = [
    facture({ statut: "payee", datePaiement: "2026-10-15" }),
    facture({ id: "f2", numero: "F-2026-002", montantHt: 120000, ...taxes(120000, true, 5, 9.975), statut: "envoyee" }),
    facture({ id: "f3", numero: "F-2025-010", statut: "payee", date: "2025-12-20", datePaiement: "2026-01-05" }),
  ];
  const transactions = [
    tx("2026-09-19", -4599, 200, 399, "affaires"),
    tx("2026-10-25", -4800, 209, 417, "affaires"),
    tx("2026-10-26", -2000, 0, 0, null),
    tx("2026-10-27", -9999, 0, 0, "epicerie", false),
    tx("2025-12-30", -1000, 50, 100, "affaires"),
  ];
  const e = etatResultats(factures, transactions, indexer(CATEGORIES), 2026, "À classer");

  it("revenus : factures payées dans l'année (selon la date de paiement), avant taxes", () => {
    expect(e.revenus).toBe(150000);
    expect(e.tpsPercue).toBe(7500);
    expect(e.tvqPercue).toBe(14962);
  });
  it("dépenses déductibles de l'année, avant taxes, par catégorie", () => {
    expect(e.depenses).toBe(4000 + 4174 + 2000);
    expect(Object.fromEntries(e.parCategorie)).toEqual({ "Dépenses d'entreprise": 8174, "À classer": 2000 });
    expect(e.benefice).toBe(150000 - 10174);
  });
  it("taxes nettes = (TPS perçue − CTI) + (TVQ perçue − RTI)", () => {
    expect(e.cti).toBe(409);
    expect(e.rti).toBe(816);
    expect(e.taxesNettes).toBe(7500 - 409 + (14962 - 816));
  });
});
