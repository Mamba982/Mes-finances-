import { describe, expect, it } from "vitest";
import { aFaireBudget } from "@/domaine/accueil";
import { indexer } from "@/domaine/budget";
import { radar } from "@/domaine/radar";
import { CATEGORIES, transactionsReleves } from "./aides";

const index = indexer(CATEGORIES);
const calcul = (aujourdhui: string, transactions = transactionsReleves()) =>
  aFaireBudget({ transactions, categories: CATEGORIES, index, radar: radar(transactions, index, aujourdhui), aujourdhui });

describe("À faire ce mois-ci (partie budget)", () => {
  it("sans aucune transaction : importer un relevé", () => {
    expect(calcul("2026-11-04", [])).toEqual([{ type: "aucune-transaction", ton: "warn" }]);
  });

  it("relevés fictifs : seuls les frais ressortent (tout est classé, aucun budget dépassé)", () => {
    expect(calcul("2026-10-31")).toEqual([{ type: "frais", ton: "warn", total: 495 * 3 + 1182 + 161 }]);
  });

  it("à classer, dépassements de budget et frais, dans cet ordre", () => {
    const base = transactionsReleves();
    const extra = [
      { ...base[0]!, id: "q", date: "2026-10-20", libelle: "QUINCAILLERIE ABC", marchand: "Quincaillerie Abc", montant: -4000, categorieId: null },
      { ...base[0]!, id: "i", date: "2026-10-21", libelle: "IKEA", marchand: "Ikea", montant: -12000, categorieId: "achats" },
    ];
    const l = calcul("2026-10-31", [...base, ...extra]);
    expect(l.map((e) => e.type)).toEqual(["a-classer", "budget-depasse", "frais"]);
    expect(l[0]).toEqual({ type: "a-classer", ton: "warn", nombre: 1 });
    // Achats d'octobre : 58,50 + 120 = 178,50 $ pour un budget de 100 $
    expect(l[1]).toEqual({ type: "budget-depasse", ton: "warn", categorie: "Achats", depassement: 7850 });
  });

  it("le mois précédent suffit pour ne pas demander d'import", () => {
    expect(calcul("2026-11-04").some((e) => e.type === "aucune-transaction")).toBe(false);
    expect(calcul("2027-01-04").some((e) => e.type === "aucune-transaction")).toBe(true);
  });
});
