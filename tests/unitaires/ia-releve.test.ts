import { describe, expect, it, vi } from "vitest";
import { construireConsigneReleve, interpreterReleve, lireReleveAvecIa, schemaDemandeReleve, schemaReponseReleve } from "@/ia/releve";

describe("lecture d'un relevé par l'IA", () => {
  it("le texte du PDF est masqué avant l'envoi et numéroté par page", () => {
    const c = construireConsigneReleve({ source: "pdf", pages: ["Compte 0012345678\n05 OCT MAXI 84,22", "Page deux"] });
    expect(c.contenu).toContain("--- Page 1 ---");
    expect(c.contenu).toContain("--- Page 2 ---");
    expect(c.contenu).not.toContain("0012345678");
    expect(c.systeme).toContain("Ne calcule rien");
  });
  it("une image part en bloc image, sans autre donnée", () => {
    const c = construireConsigneReleve({ source: "image", type: "image/jpeg", donnees: "QUJD" });
    expect(Array.isArray(c.contenu) && c.contenu[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg", data: "QUJD" } });
  });
  it("refuse plus de 10 pages, une image trop lourde ou un type d'image inconnu", () => {
    expect(schemaDemandeReleve.safeParse({ source: "pdf", pages: Array(11).fill("x") }).success).toBe(false);
    expect(schemaDemandeReleve.safeParse({ source: "image", type: "image/gif", donnees: "QUJD" }).success).toBe(false);
    expect(schemaDemandeReleve.safeParse({ source: "image", type: "image/jpeg", donnees: "A".repeat(3_000_004) }).success).toBe(false);
  });
  it("montants lus par le domaine en cents ; lignes douteuses écartées ; numéros masqués à la sortie aussi", () => {
    const r = interpreterReleve({
      transactions: [
        { date: "2026-10-05", description: "MAXI   QUEBEC", montant: "-84,22" },
        { date: "2026-10-06", description: "PAIE", montant: "1 450,00" },
        { date: "2026-10-07", description: "ACHAT", montant: "-1,234.56" },
        { date: "2026-10-08", description: "VIREMENT 4520 1234 5678 9012", montant: "-500.00" },
        { date: "2026-02-30", description: "DATE IMPOSSIBLE", montant: "-1.00" },
        { date: "05 OCT", description: "DATE NON NORMALISÉE", montant: "-1.00" },
        { date: "2026-10-09", description: "MONTANT ILLISIBLE", montant: "environ 12" },
        { date: "2026-10-09", description: "ZÉRO", montant: "0,00" },
        { date: "2026-10-09", description: "   ", montant: "-3,00" },
      ],
    });
    expect(r.lignes).toEqual([
      { date: "2026-10-05", libelle: "MAXI QUEBEC", montant: -8422 },
      { date: "2026-10-06", libelle: "PAIE", montant: 145000 },
      { date: "2026-10-07", libelle: "ACHAT", montant: -123456 },
      { date: "2026-10-08", libelle: "VIREMENT [numéro masqué]", montant: -50000 },
    ]);
    expect(r.ecartees).toBe(5);
  });
  it("avec un faux modèle : gamme complète, schéma de réponse, jetons remontés", async () => {
    const appel = vi.fn().mockResolvedValue({
      donnees: { transactions: [{ date: "2026-10-05", description: "MAXI", montant: "-84,22" }] },
      modele: "claude-sonnet-5-5",
      jetonsEntree: 9000,
      jetonsSortie: 3000,
    });
    const r = await lireReleveAvecIa(appel, { source: "pdf", pages: ["x"] });
    expect(appel.mock.calls[0]![0]).toMatchObject({ gamme: "complet", schema: schemaReponseReleve });
    expect(r).toEqual({ lignes: [{ date: "2026-10-05", libelle: "MAXI", montant: -8422 }], ecartees: 0, modele: "claude-sonnet-5-5", jetonsEntree: 9000, jetonsSortie: 3000 });
  });
});
