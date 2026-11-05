import { describe, expect, it } from "vitest";
import { borneDuree, coutChange, croissance, enveloppe, patrimoine, type Compte } from "@/domaine/placements";

const compte = (type: Compte["type"], solde: number): Compte => ({ id: type, nom: type, type, solde, majLe: "2026-11-04" });

describe("avoir net", () => {
  it("actifs − dettes (comptes de l'exemple du prototype)", () => {
    expect(patrimoine([compte("celi", 240000), compte("epargne", 120000), compte("dette", 64000)])).toEqual({
      actifs: 360000,
      dettes: 64000,
      net: 296000,
    });
  });
  it("sans compte : 0", () => {
    expect(patrimoine([])).toEqual({ actifs: 0, dettes: 0, net: 0 });
  });
});

describe("simulateur de croissance", () => {
  it("sans rendement ni frais : la valeur finale égale le total versé", () => {
    const c = croissance(100000, 20000, 0, 0, 10);
    expect(c.totalVerse).toBe(100000 + 20000 * 120);
    expect(c.valeurFinale).toBeCloseTo(c.totalVerse, 6);
    expect(c.coutDesFrais).toBeCloseTo(0, 6);
  });
  it("1 000 $ + 200 $/mois, 5 % pendant 10 ans : formule de la valeur future", () => {
    const r = 0.05 / 12;
    const attendu = 100000 * (1 + r) ** 120 + 20000 * (((1 + r) ** 120 - 1) / r);
    expect(croissance(100000, 20000, 5, 0, 10).valeurFinale).toBeCloseTo(attendu, 4);
  });
  it("2 % de frais coûtent la différence entre les deux courbes", () => {
    const c = croissance(100000, 20000, 5, 2, 10);
    expect(c.coutDesFrais).toBeCloseTo(c.valeurSansFrais - c.valeurFinale, 6);
    expect(Math.round(c.coutDesFrais / 100)).toBe(Math.round((croissance(100000, 20000, 5, 0, 10).valeurFinale - c.valeurFinale) / 100));
    // Valeur future à 3 % (5 % − 2 %) comparée à 5 % : environ 3 406 $ de moins
    const vf = (taux: number) => {
      const r = taux / 100 / 12;
      return 100000 * (1 + r) ** 120 + 20000 * (((1 + r) ** 120 - 1) / r);
    };
    expect(c.coutDesFrais).toBeCloseTo(vf(5) - vf(3), 4);
    expect(Math.round(c.coutDesFrais / 100)).toBe(3406);
  });
  it("un point au départ, un par année, et un à la fin d'une durée fractionnaire", () => {
    expect(croissance(0, 100, 5, 0, 10).points).toHaveLength(11);
    expect(croissance(0, 100, 5, 0, 2.5).points).toHaveLength(4);
  });
  it("durée bornée entre 0,1 et 50 ans", () => {
    expect(borneDuree(0)).toBe(0.1);
    expect(borneDuree(80)).toBe(50);
  });
});

describe("type de compte selon le projet", () => {
  const p = (nom: string, mois: number) => enveloppe({ projet: { nom }, mois });
  it.each([
    ["Mise de fonds condo", 40, "celiapp"],
    ["Achat d'une maison", 80, "celiapp"],
    ["Études des enfants", 100, "reee"],
    ["Fonds d'urgence", 50, "court"],
    ["Ordinateur portable", 6, "court"],
    ["Voyage", 24, "court"],
    ["Voyage", 25, "moyen"],
    ["Retraite", 61, "long"],
  ] as const)("« %s » dans %d mois → %s", (nom, mois, e) => expect(p(nom, mois)).toBe(e));
});

describe("frais de change", () => {
  it("5 000 $ par mois à 1,5 % : 75 $ l'aller, 150 $ l'aller-retour, 1 800 $ par an", () => {
    const c = coutChange(500000, 1.5, 1000);
    expect(c.allerMensuel).toBe(7500);
    expect(c.allerRetourMensuel).toBe(15000);
    expect(c.allerRetourAnnuel).toBe(180000);
  });
  it("compte US à 10 $/mois : rentable au-delà de 666,67 $ convertis par mois", () => {
    const c = coutChange(500000, 1.5, 1000);
    expect(c.seuilRentabilite).toBeCloseTo(66666.67, 1);
    expect(c.compteUsRentable).toBe(true);
    expect(coutChange(60000, 1.5, 1000).compteUsRentable).toBe(false);
  });
  it("sans frais de conversion, aucun seuil", () => {
    expect(coutChange(500000, 0, 1000)).toEqual(expect.objectContaining({ allerMensuel: 0, seuilRentabilite: 0, compteUsRentable: true }));
  });
});
