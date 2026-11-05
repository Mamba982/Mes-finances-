import { describe, expect, it } from "vitest";
import { indexer, type Transaction } from "@/domaine/budget";
import { radar, typeFrais } from "@/domaine/radar";
import { CATEGORIES, transactionsReleves } from "./aides";

const cats = indexer(CATEGORIES);

describe("radar à frais sur les relevés fictifs", () => {
  const r = radar(transactionsReleves(), cats, "2026-11-04");

  it("total des frais sur 12 mois et total par type", () => {
    expect(r.totalFrais).toBe(495 * 3 + 1182 + 161);
    expect(r.parType).toEqual({ "Frais de compte et autres": 1485, Intérêts: 1182, "Frais de change": 161 });
  });

  it("paiements récurrents réguliers, triés par coût annuel", () => {
    expect(r.recurrents.map((x) => [x.nom, x.mensuel, x.nbMois])).toEqual([
      ["Remitly Transfert", 15000, 3],
      ["Rtc Opus", 9700, 3],
      ["Videotron Ltee", 8500, 3],
      ["Netflix.com", 1899, 3],
      ["Spotify P2f3", 1299, 3],
    ]);
    expect(r.totalRecurrents).toBe((15000 + 9700 + 8500 + 1899 + 1299) * 12);
  });

  it("écarte un marchand dont le montant varie de plus de max(0,50 $ ; 5 %)", () => {
    expect(r.recurrents.some((x) => x.nom.startsWith("Tim"))).toBe(false);
  });
});

describe("règles du radar", () => {
  const t = (date: string, libelle: string, montant: number, categorieId: string | null = null): Transaction => ({
    id: date + libelle,
    date,
    libelle,
    marchand: libelle,
    montant,
    categorieId,
    deductible: false,
    tps: 0,
    tvq: 0,
  });

  it("classe les frais par type", () => {
    expect(typeFrais("FRAIS NSF")).toBe("Provision insuffisante");
    expect(typeFrais("Frais de conversion")).toBe("Frais de change");
    expect(typeFrais("INTERET SUR DECOUVERT")).toBe("Intérêts");
    expect(typeFrais("Frais mensuels")).toBe("Frais de compte et autres");
  });

  it("ignore ce qui a plus de 12 mois", () => {
    const r = radar([t("2025-11-28", "FRAIS MENSUELS", -495), t("2025-12-28", "FRAIS MENSUELS", -495)], cats, "2026-11-04");
    expect(r.totalFrais).toBe(495);
  });

  it("tolère 5 % d'écart sur un gros montant, et au plus 0,50 $ sur un petit", () => {
    const gros = radar([t("2026-09-01", "ASSURANCE AUTO", -20000), t("2026-10-01", "ASSURANCE AUTO", -20900)], cats, "2026-11-04");
    expect(gros.recurrents).toHaveLength(1);
    const petit = radar([t("2026-09-01", "APPLI", -500), t("2026-10-01", "APPLI", -620)], cats, "2026-11-04");
    expect(petit.recurrents).toHaveLength(0);
  });

  it("écarte un marchand vu plus de (mois + 1) fois", () => {
    const l = ["2026-09-01", "2026-09-10", "2026-09-20", "2026-10-01"].map((d) => t(d, "CAFE", -500));
    expect(radar(l, cats, "2026-11-04").recurrents).toHaveLength(0);
  });
});
