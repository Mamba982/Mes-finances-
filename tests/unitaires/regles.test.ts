import { describe, expect, it } from "vitest";
import { classer, motifDepuisLibelle, motifValide, normaliserTexte, regleApplicable, type RegleCategorie } from "@/domaine/regles";

const regle = (motif: string, categorieId: string, origine: RegleCategorie["origine"] = "manuel"): RegleCategorie => ({
  id: motif,
  motif,
  categorieId,
  origine,
});
const PAR_CODE = new Map([
  ["epicerie", "cat-epicerie"],
  ["restaurants", "cat-restaurants"],
  ["autres-revenus", "cat-autres-revenus"],
]);

describe("normalisation", () => {
  it("minuscules, sans accents ni ponctuation", () => {
    expect(normaliserTexte("  Épicerie MAXI #8812, Québec ")).toBe("epicerie maxi 8812 quebec");
  });
  it("motif valide : 2 à 80 caractères après normalisation", () => {
    expect(motifValide("Garderie")).toBe("garderie");
    expect(motifValide("é")).toBeNull();
    expect(motifValide("!!!")).toBeNull();
    expect(motifValide("x".repeat(81))).toBeNull();
  });
  it("le motif retenu après une correction est le marchand", () => {
    expect(motifDepuisLibelle("MAXI #8812 QUEBEC")).toBe("maxi quebec");
    expect(motifDepuisLibelle("ACHAT INTERAC GARDERIE LES PETITS LOUPS")).toBe("garderie les petits");
    expect(motifDepuisLibelle("#")).toBeNull();
  });
});

describe("règle applicable", () => {
  it("mot entier seulement : « iga » ne correspond pas à « gigantesque »", () => {
    expect(regleApplicable([regle("iga", "a")], "IGA EXTRA 0421")?.categorieId).toBe("a");
    expect(regleApplicable([regle("iga", "a")], "GIGANTESQUE")).toBeNull();
  });
  it("la règle la plus précise gagne", () => {
    const r = [regle("amazon", "achats"), regle("amazon prime", "abonnements")];
    expect(regleApplicable(r, "AMAZON PRIME CA")?.categorieId).toBe("abonnements");
    expect(regleApplicable(r, "AMAZON.CA COMMANDE")?.categorieId).toBe("achats");
  });
  it("à précision égale, une règle ajoutée à la main passe avant une règle retenue", () => {
    const r = [regle("costco", "auto-cat", "auto"), regle("costco", "manuel-cat", "manuel")];
    expect(regleApplicable(r, "COSTCO WHOLESALE")?.categorieId).toBe("manuel-cat");
  });
  it("une règle retenue sur le marchand s'applique malgré un numéro de succursale différent", () => {
    expect(regleApplicable([regle("maxi quebec", "a", "auto")], "MAXI #1234 QUEBEC")?.categorieId).toBe("a");
  });
});

describe("classement", () => {
  it("les règles de l'utilisateur passent avant les règles par défaut", () => {
    expect(classer("MAXI #8812 QUEBEC", -9100, [regle("maxi", "cat-restaurants")], PAR_CODE)).toEqual({
      categorieId: "cat-restaurants",
      source: "regle",
      motif: "maxi",
    });
  });
  it("sans règle, les règles par défaut du prototype s'appliquent", () => {
    expect(classer("MAXI #8812 QUEBEC", -9100, [], PAR_CODE)).toEqual({ categorieId: "cat-epicerie", source: "defaut" });
  });
  it("aucune règle ne correspond : à classer", () => {
    expect(classer("QUINCAILLERIE ABC", -2000, [], PAR_CODE)).toBeNull();
  });
  it("une règle de l'utilisateur s'applique aussi aux remboursements (montant positif)", () => {
    expect(classer("MAXI REMBOURSEMENT", 1500, [regle("maxi", "cat-epicerie")], PAR_CODE)?.categorieId).toBe("cat-epicerie");
  });
});
