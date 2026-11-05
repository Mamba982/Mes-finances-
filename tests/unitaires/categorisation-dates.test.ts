import { describe, expect, it } from "vitest";
import { categorieAuto, normaliserMarchand } from "@/domaine/categorisation";
import { ajouterJours, ajouterMois, estDateISO, joursEntre, libelleDate, libelleMois, moisEntre } from "@/domaine/dates";

describe("classement automatique", () => {
  it.each([
    ["DEPOT DIRECT PAIE EMPLOYEUR", 145000, "salaire"],
    ["DEPOT DIRECT PAIE EMPLOYEUR", -100, null],
    ["MAXI #8812 QUEBEC", -8800, "epicerie"],
    ["MAXI #8812 QUEBEC", 8800, "autres-revenus"],
    ["UBER EATS", -2500, "restaurants"],
    ["UBER TRIP", -1800, "transport"],
    ["VIREMENT VERS EPARGNE", -30000, "epargne"],
    ["VIREMENT DEPUIS EPARGNE", 30000, "epargne"],
    ["INTERETS CARTE DE CREDIT", -1182, "frais"],
    ["REMITLY TRANSFERT", -15000, "famille"],
    ["QUINCAILLERIE ABC", -2000, null],
  ])("« %s » (%d) → %s", (libelle, montant, code) => {
    expect(categorieAuto(libelle, montant)).toBe(code);
  });

  it.each([
    ["MAXI #8812 QUEBEC", "Maxi Quebec"],
    ["ACHAT INTERAC TIM HORTONS #2231", "Tim Hortons"],
    ["RTC CARTE OPUS", "Rtc Opus"],
    ["12345", "12345"],
  ])("marchand de « %s » : %s", (l, m) => expect(normaliserMarchand(l)).toBe(m));
});

describe("dates", () => {
  it("mois calendaires entre deux dates, jours ignorés", () => {
    expect(moisEntre("2026-11-30", "2027-09-01")).toBe(10);
    expect(moisEntre("2026-11-04", "2026-11-28")).toBe(0);
    expect(moisEntre("2026-11-04", "2026-10-28")).toBe(-1);
  });
  it("ajoute des mois et des jours", () => {
    expect(ajouterMois("2026-11", 2)).toBe("2027-01");
    expect(ajouterMois("2026-01", -1)).toBe("2025-12");
    expect(ajouterJours("2026-02-27", 2)).toBe("2026-03-01");
    expect(joursEntre("2026-10-30", "2026-11-02")).toBe(3);
  });
  it("valide une date réelle", () => {
    expect(estDateISO("2026-02-29")).toBe(false);
    expect(estDateISO("2028-02-29")).toBe(true);
  });
  it("libellés en français", () => {
    expect(libelleMois("2026-11")).toBe("Novembre 2026");
    expect(libelleDate("2026-07-04")).toBe("4 juill. 2026");
    expect(libelleDate("2026-08-04", false)).toBe("4 août");
  });
});
