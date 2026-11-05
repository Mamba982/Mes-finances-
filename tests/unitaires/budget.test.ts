import { describe, expect, it } from "vitest";
import { bilan, capacite, capaciteAuto, indexer, type Transaction } from "@/domaine/budget";
import { CATEGORIES, transactionsReleves } from "./aides";

const cats = indexer(CATEGORIES);
const txs = transactionsReleves();
const tx = (date: string, montant: number, categorieId: string | null): Transaction => ({
  id: date + montant,
  date,
  libelle: "x",
  marchand: "X",
  montant,
  categorieId,
  deductible: false,
  tps: 0,
  tvq: 0,
});

describe("bilan du mois", () => {
  it("août 2026 : revenus, dépenses, épargne mise de côté", () => {
    const b = bilan(txs, "2026-08", cats);
    expect(b.revenus).toBe(290000);
    expect(b.depenses).toBe(179325);
    expect(b.epargne).toBe(30000);
    expect(b.solde).toBe(110675);
    expect(b.parCategorie.get("logement")).toBe(105000 + 6600);
  });

  it("une transaction sans catégorie compte comme revenu si positive, dépense si négative", () => {
    const b = bilan([tx("2026-10-01", 5000, null), tx("2026-10-02", -2000, null)], "2026-10", cats);
    expect(b.revenus).toBe(5000);
    expect(b.depenses).toBe(2000);
    expect(b.parCategorie.get("_")).toBe(2000);
  });
});

describe("capacité d'épargne automatique", () => {
  it("moyenne des 3 derniers mois complets (août, sept., oct.) ; novembre exclu", () => {
    const a = capaciteAuto(txs, cats, "2026-11-04")!;
    expect(a.mois).toEqual(["2026-08", "2026-09", "2026-10"]);
    // (1 106,75 + 1 034,76 + 1 011,57) ÷ 3
    expect(a.valeur).toBeCloseTo(315308 / 3, 6);
  });

  it("les transactions d'épargne n'entrent ni dans les revenus ni dans les dépenses", () => {
    const sans = txs.filter((t) => t.categorieId !== "epargne");
    expect(capaciteAuto(sans, cats, "2026-11-04")!.valeur).toBeCloseTo(315308 / 3, 6);
  });

  it("prend les 3 derniers mois qui ont des transactions, même non consécutifs", () => {
    const l = [tx("2026-01-05", 1000, "salaire"), tx("2026-04-05", 2000, "salaire"), tx("2026-07-05", 3000, "salaire"), tx("2026-09-05", 6000, "salaire")];
    const a = capaciteAuto(l, cats, "2026-11-04")!;
    expect(a.mois).toEqual(["2026-04", "2026-07", "2026-09"]);
    expect(a.valeur).toBeCloseTo(11000 / 3, 9);
  });

  it("ne descend pas sous 0", () => {
    expect(capaciteAuto([tx("2026-10-05", -5000, "epicerie")], cats, "2026-11-04")!.valeur).toBe(0);
  });

  it("sans mois complet, utilise le montant manuel", () => {
    const c = capacite({ mode: "auto", manuelle: 40000 }, [tx("2026-11-02", 1000, "salaire")], cats, "2026-11-04");
    expect(c).toEqual({ valeur: 40000, source: "manuel" });
  });

  it("en mode manuel, ignore les transactions", () => {
    expect(capacite({ mode: "manuel", manuelle: 25000 }, txs, cats, "2026-11-04").valeur).toBe(25000);
  });
});
