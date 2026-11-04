import { describe, expect, it } from "vitest";
import { centsVersDecimal, decimalVersCents, formaterMontant, lireMontant } from "@/domaine/argent";

describe("decimalVersCents", () => {
  it.each([
    ["862.31", 86231],
    ["-84.2", -8420],
    ["5000", 500000],
    ["0.10", 10],
    ["9999999999.99", 999999999999],
    ["1.005", 101],
    ["1.004", 100],
  ])("%s → %d cents", (s, c) => expect(decimalVersCents(s)).toBe(c));

  it("refuse un texte qui n'est pas décimal", () => {
    expect(() => decimalVersCents("12,34")).toThrow();
  });

  it("évite l'erreur de flottant de 0,1 + 0,2", () => {
    expect(decimalVersCents("0.1") + decimalVersCents("0.2")).toBe(30);
  });
});

describe("centsVersDecimal", () => {
  it.each([
    [86231, "862.31"],
    [-8420, "-84.20"],
    [5, "0.05"],
    [-5, "-0.05"],
    [0, "0.00"],
  ])("%d → %s", (c, s) => expect(centsVersDecimal(c)).toBe(s));

  it("refuse des cents fractionnaires", () => {
    expect(() => centsVersDecimal(1.5)).toThrow();
  });
});

describe("lireMontant (formats des relevés)", () => {
  it.each([
    ["1 234,56", 123456],
    ["1 234,56", 123456],
    ["-84.22", -8422],
    ["(12,34)", -1234],
    ["84,22-", -8422],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["$45.99", 4599],
    ["12,5", 1250],
    ["1,234", 123400],
    ["0", 0],
  ])("« %s » → %d cents", (s, c) => expect(lireMontant(s)).toBe(c));

  it.each(["", "abc", "12a", null, undefined])("« %s » n'est pas un montant", (s) => {
    expect(lireMontant(s)).toBeNull();
  });
});

describe("formaterMontant", () => {
  const n = (s: string) => s.replace(/[  ]/g, " ");
  it("affiche en fr-CA sans décimales par défaut", () => {
    expect(n(formaterMontant(123456))).toBe("1 235 $");
  });
  it("affiche deux décimales sur demande", () => {
    expect(n(formaterMontant(-8422, 2))).toBe("-84,22 $");
  });
});
