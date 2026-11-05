import { describe, expect, it } from "vitest";
import { taxes, type Facture } from "@/domaine/factures";
import type { Profil } from "@/donnees/profil";
import { htmlFacture, texteFacture } from "@/ui/facture-document";

const f: Facture = {
  id: "f1", numero: "F-2026-001", client: "Restaurant <Le Baobab>", courriel: "resto@exemple.ca", description: "Traiteur, 40 personnes",
  montantHt: 75000, taxable: true, tauxTps: 5, tauxTvq: 9.975, ...taxes(75000, true, 5, 9.975),
  date: "2026-09-20", echeance: "2026-10-20", statut: "envoyee", datePaiement: null,
};
const p = {
  devise: "CAD", entreprise_nom: "Mon entreprise", entreprise_adresse: "123, rue Principale, Québec", no_tps: "123456789 RT0001", no_tvq: "1234567890 TQ0001",
} as Profil;
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("document de facture", () => {
  it("texte : en-tête, taxes avec numéros d'inscription, total", () => {
    const t = n(texteFacture(f, p));
    expect(t).toContain("FACTURE F-2026-001");
    expect(t).toContain("Échéance : 20 oct. 2026");
    expect(t).toContain("TPS (5 %) n° 123456789 RT0001 : 37,50 $");
    expect(t).toContain("TVQ (9,975 %) n° 1234567890 TQ0001 : 74,81 $");
    expect(t).toContain("TOTAL : 862,31 $");
  });
  it("sans taxes : aucune ligne TPS ni TVQ", () => {
    const t = texteFacture({ ...f, taxable: false, ...taxes(75000, false, 5, 9.975) }, p);
    expect(t).not.toMatch(/TPS|TVQ/);
  });
  it("HTML : en français et sans injection de balises", () => {
    const h = htmlFacture(f, p);
    expect(h).toContain('lang="fr-CA"');
    expect(h).toContain("Restaurant &lt;Le Baobab&gt;");
    expect(h).not.toContain("<Le Baobab>");
  });
});
