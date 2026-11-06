import { describe, expect, it } from "vitest";
import { lignesDepuisMorceaux } from "@/import/pdf/lignes";

describe("texte d'une page PDF remis en lignes", () => {
  it("regroupe par ligne, de haut en bas et de gauche à droite, en gardant les colonnes", () => {
    const l = lignesDepuisMorceaux([
      { texte: "84,22", x: 300, y: 700 },
      { texte: "05 OCT", x: 40, y: 700.8 },
      { texte: "MAXI QUEBEC", x: 100, y: 700 },
      { texte: "Date", x: 40, y: 720 },
      { texte: "Retraits", x: 300, y: 720 },
      { texte: "Dépôts", x: 400, y: 720 },
      { texte: "PAIE", x: 100, y: 680 },
      { texte: "1 450,00", x: 400, y: 680 },
    ]);
    expect(l).toHaveLength(3);
    expect(l[0]).toMatch(/^ {10}Date {61}Retraits {17}Dépôts$/);
    // Le montant de la ligne MAXI tombe sous « Retraits », celui de la paie sous « Dépôts ».
    expect(l[1]!.indexOf("84,22")).toBe(l[0]!.indexOf("Retraits"));
    expect(l[2]!.indexOf("1 450,00")).toBe(l[0]!.indexOf("Dépôts"));
  });
  it("sépare d'une espace des morceaux qui se chevauchent et ignore les morceaux vides", () => {
    expect(lignesDepuisMorceaux([{ texte: "ABC", x: 0, y: 10 }, { texte: "  ", x: 2, y: 10 }, { texte: "DEF", x: 4, y: 10 }])).toEqual(["ABC DEF"]);
  });
});
