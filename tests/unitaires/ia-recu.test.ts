import { describe, expect, it, vi } from "vitest";
import { construireConsigneRecu, interpreterRecu, lireRecuAvecIa, schemaDemandeRecu, schemaReponseRecu } from "@/ia/recu";

describe("lecture d'un reçu par l'IA", () => {
  it("montants convertis par le domaine, en positif ; date validée ; numéros masqués", () => {
    expect(
      interpreterRecu({ date: "2026-10-12", marchand: "BUREAU EN GROS #123", description: "Papier  et encre, carte 4520123456789012", total: "57,47", tps: "2,50", tvq: "4,99" }),
    ).toEqual({ date: "2026-10-12", marchand: "BUREAU EN GROS #123", description: "Papier et encre, carte [numéro masqué]", total: 5747, tps: 250, tvq: 499 });
  });
  it("champ absent, illisible ou incohérent : laissé vide pour la saisie à la main", () => {
    expect(interpreterRecu({ date: "12/10/2026", marchand: "  ", description: null, total: "0,00", tps: "environ 2", tvq: null })).toEqual({
      date: null, marchand: null, description: null, total: null, tps: null, tvq: null,
    });
  });
  it("seule une image de type connu et de taille raisonnable est acceptée", () => {
    expect(schemaDemandeRecu.safeParse({ type: "image/jpeg", donnees: "QUJD" }).success).toBe(true);
    expect(schemaDemandeRecu.safeParse({ type: "application/pdf", donnees: "QUJD" }).success).toBe(false);
    expect(schemaDemandeRecu.safeParse({ type: "image/jpeg", donnees: "pas du base64 !" }).success).toBe(false);
  });
  it("la consigne interdit tout calcul ; avec un faux modèle : gamme complète", async () => {
    expect(construireConsigneRecu({ type: "image/png", donnees: "QUJD" }).systeme).toContain("sans le calculer");
    const appel = vi.fn().mockResolvedValue({ donnees: { date: null, marchand: "X", description: null, total: "1,00", tps: null, tvq: null }, modele: "m", jetonsEntree: 1, jetonsSortie: 1 });
    const r = await lireRecuAvecIa(appel, { type: "image/png", donnees: "QUJD" });
    expect(appel.mock.calls[0]![0]).toMatchObject({ gamme: "complet", schema: schemaReponseRecu });
    expect(r.recu.total).toBe(100);
  });
});
