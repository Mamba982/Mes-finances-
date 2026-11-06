import { describe, expect, it, vi } from "vitest";
import { montantPoste } from "@/domaine/estimation";
import { construireConsigneEstimation, estimerAvecIa, interpreterEstimation, schemaReponseEstimation } from "@/ia/estimation";

describe("montant d'un poste estimé", () => {
  it("quantité × prix unitaire, arrondi au cent", () => {
    expect(montantPoste(2, 89900)).toBe(179800);
    expect(montantPoste(1.5, 3333)).toBe(5000);
  });
  it.each([[0, 100], [-1, 100], [1001, 100], [Number.NaN, 100], [1, -5], [1, 1.5]])("refuse %s × %s", (q, p) => expect(montantPoste(q, p)).toBeNull());
});

describe("estimation de projet par l'IA", () => {
  it("le modèle ne donne que quantité et prix : le domaine multiplie ; postes douteux écartés", () => {
    const r = interpreterEstimation({
      postes: [
        { nom: "Billets d'avion Montréal–Lisbonne", quantite: 2, prixUnitaire: "1 150,00", explication: "Aller-retour en juillet, classe économique." },
        { nom: "Hébergement", quantite: 13, prixUnitaire: "145.00", explication: "Nuits en appartement." },
        { nom: "Prix illisible", quantite: 1, prixUnitaire: "selon la saison", explication: "" },
        { nom: "Quantité absurde", quantite: 0, prixUnitaire: "10", explication: "" },
      ],
    });
    expect(r).toEqual([
      { nom: "Billets d'avion Montréal–Lisbonne", quantite: 2, prixUnitaire: 115000, montant: 230000, explication: "Aller-retour en juillet, classe économique." },
      { nom: "Hébergement", quantite: 13, prixUnitaire: 14500, montant: 188500, explication: "Nuits en appartement." },
    ]);
  });
  it("la consigne interdit les totaux ; avec un faux modèle : gamme complète", async () => {
    expect(construireConsigneEstimation({ nom: "Voyage", description: "", echeance: "2027-06-01", aujourdhui: "2026-11-06" }).systeme).toContain("Ne fais aucun total");
    const appel = vi.fn().mockResolvedValue({ donnees: { postes: [] }, modele: "m", jetonsEntree: 1, jetonsSortie: 1 });
    await estimerAvecIa(appel, { nom: "Voyage", description: "", echeance: "2027-06-01", aujourdhui: "2026-11-06" });
    expect(appel.mock.calls[0]![0]).toMatchObject({ gamme: "complet", schema: schemaReponseEstimation });
  });
});
