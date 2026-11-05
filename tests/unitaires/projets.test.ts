import { describe, expect, it } from "vitest";
import {
  appliquerScenario,
  comparerScenario,
  effortRequis,
  epargneCumulee,
  horizonDe,
  projetAAfficher,
  repartir,
  trierPourAffichage,
} from "@/domaine/projets";
import { AUJOURDHUI, projetsExemple } from "./aides";

describe("horizon et effort requis", () => {
  it.each([
    [0, "court"], [12, "court"], [13, "moyen"], [60, "moyen"], [61, "long"],
  ] as const)("%d mois → %s", (m, h) => expect(horizonDe(m)).toBe(h));

  it("reste ÷ max(1, mois restants)", () => {
    expect(effortRequis(350000, 10)).toBe(35000);
    expect(effortRequis(350000, 0)).toBe(350000);
    expect(effortRequis(350000, -3)).toBe(350000);
    expect(effortRequis(0, 10)).toBe(0);
  });
});

describe("3 projets, capacité insuffisante (500 $)", () => {
  const r = repartir(projetsExemple(), 50000, AUJOURDHUI);
  const [p1, p2, p3] = r.projets;

  it("effort requis par projet", () => {
    expect(p1!.requis).toBe(35000); // 3 500 $ ÷ 10 mois
    expect(p2!.requis).toBeCloseTo(340000 / 14, 9); // 3 400 $ ÷ 14 mois
    expect(p3!.requis).toBeCloseTo(160000 / 6, 9); // 1 600 $ ÷ 6 mois
  });

  it("répartition par priorité : 350 $, 150 $, 0 $", () => {
    expect([p1!.alloue, p2!.alloue, p3!.alloue]).toEqual([35000, 15000, 0]);
    expect(r.margeRestante).toBe(0);
  });

  it("statuts : dans les temps, sous-financé, non financé", () => {
    expect([p1!.statut, p2!.statut, p3!.statut]).toEqual(["ok", "retard", "nonfinance"]);
  });

  it("manque mensuel = 500 $ − 859,52 $", () => {
    expect(r.totaux.requis).toBeCloseTo(35000 + 340000 / 14 + 160000 / 6, 9);
    expect(r.ecart).toBeCloseTo(50000 - (35000 + 340000 / 14 + 160000 / 6), 9);
    expect(Math.round(r.ecart)).toBe(-35952);
  });

  it("le projet sous-financé atteint son objectif vers octobre 2028 (⌈3 400 ÷ 150⌉ = 23 mois)", () => {
    expect(p2!.atteinteProjetee).toBe("2028-10-01");
    expect(p3!.atteinteProjetee).toBeNull();
  });

  it("horizons et totaux par horizon", () => {
    expect([p1!.horizon, p2!.horizon, p3!.horizon]).toEqual(["court", "moyen", "court"]);
    expect(r.parHorizon.court).toEqual({ nombre: 2, reste: 510000, requis: 35000 + 160000 / 6 });
  });

  it("projet le plus à risque : le non financé", () => {
    expect(projetAAfficher(r)).toEqual({ calcul: p3, aRisque: true });
  });
});

describe("autres règles", () => {
  it("à priorité égale, l'échéance la plus proche passe d'abord", () => {
    const l = projetsExemple().map((p) => ({ ...p, priorite: 1 as const }));
    const r = repartir(l, 30000, AUJOURDHUI);
    // p3 (mai 2027) d'abord : 266,67 $ ; p1 (sept. 2027) reçoit le reste : 33,33 $
    expect(r.projets[2]!.alloue).toBeCloseTo(160000 / 6, 9);
    expect(r.projets[0]!.alloue).toBeCloseTo(30000 - 160000 / 6, 9);
    expect(trierPourAffichage(r).map((x) => x.projet.id)).toEqual(["p3", "p1", "p2"]);
  });

  it("échéance dépassée : statut prioritaire, et le projet réclame tout son reste ce mois-ci", () => {
    const l = [{ ...projetsExemple()[2]!, echeance: "2026-10-15" }];
    const r = repartir(l, 200000, AUJOURDHUI);
    expect(r.projets[0]!.statut).toBe("depasse");
    expect(r.projets[0]!.requis).toBe(160000);
  });

  it("une échéance aujourd'hui n'est pas dépassée", () => {
    const r = repartir([{ ...projetsExemple()[2]!, echeance: AUJOURDHUI }], 200000, AUJOURDHUI);
    expect(r.projets[0]!.statut).toBe("ok");
  });

  it("objectif atteint dès que l'épargne couvre le coût ; un retrait le fait repasser sous l'objectif", () => {
    const p = { ...projetsExemple()[2]!, montantDepart: 160000 };
    expect(repartir([p], 0, AUJOURDHUI).projets[0]!.statut).toBe("atteint");
    const retrait = { ...p, versements: [{ id: "r", montant: -10000, date: AUJOURDHUI, note: null }] };
    expect(repartir([retrait], 0, AUJOURDHUI).projets[0]!.statut).toBe("nonfinance");
  });

  it("tolérance de 0,50 $ pour « dans les temps »", () => {
    const p = { ...projetsExemple()[2]!, cout: 600000, echeance: "2027-05-04" }; // 1 000 $ / mois
    expect(repartir([p], 99950, AUJOURDHUI).projets[0]!.statut).toBe("ok");
    expect(repartir([p], 99949, AUJOURDHUI).projets[0]!.statut).toBe("retard");
  });

  it("sans projet à risque, affiche la prochaine échéance", () => {
    const r = repartir(projetsExemple(), 200000, AUJOURDHUI);
    expect(projetAAfficher(r)).toEqual({ calcul: r.projets[2], aRisque: false });
  });
});

describe("épargne cumulée sur 24 mois", () => {
  const r = repartir(projetsExemple(), 50000, AUJOURDHUI);
  const pts = epargneCumulee(r, AUJOURDHUI);
  it("25 points, de novembre 2026 à novembre 2028", () => {
    expect(pts).toHaveLength(25);
    expect(pts[0]!.mois).toBe("2026-11");
    expect(pts[24]!.mois).toBe("2028-11");
  });
  it("part de l'épargne actuelle et ajoute les versements alloués", () => {
    expect(pts[0]!.prevue).toBe(150000 + 40000);
    expect(pts[1]!.prevue).toBe(190000 + 35000 + 15000);
    expect(pts[10]!.prevue).toBe(190000 + 350000 + 150000);
  });
  it("le coût des projets s'ajoute au mois de leur échéance", () => {
    expect(pts[5]!.coutEchu).toBe(0);
    expect(pts[6]!.coutEchu).toBe(160000);
    expect(pts[10]!.coutEchu).toBe(660000);
    expect(pts[14]!.coutEchu).toBe(1040000);
  });
});

describe("scénarios", () => {
  it("modifie une copie : les projets d'origine ne changent pas", () => {
    const origine = projetsExemple();
    const copie = appliquerScenario(origine, { delta: 0, projets: { p3: { echeance: "2027-11-04", cout: 120000 } } });
    expect(copie[2]).toEqual(expect.objectContaining({ echeance: "2027-11-04", cout: 120000 }));
    expect(origine[2]).toEqual(expect.objectContaining({ echeance: "2027-05-04", cout: 160000 }));
  });

  it("repousser l'ordinateur d'un an et épargner 200 $ de plus réduit le manque", () => {
    const { avant, apres } = comparerScenario(
      projetsExemple(),
      50000,
      { delta: 20000, projets: { p3: { echeance: "2027-11-04" } } },
      AUJOURDHUI,
    );
    expect(apres.capacite).toBe(70000);
    expect(apres.ecart).toBeGreaterThan(avant.ecart);
    expect(Math.round(apres.ecart)).toBe(Math.round(70000 - (35000 + 340000 / 14 + 160000 / 12)));
  });

  it("une baisse d'épargne ne rend pas la capacité négative", () => {
    expect(comparerScenario(projetsExemple(), 50000, { delta: -90000, projets: {} }, AUJOURDHUI).apres.capacite).toBe(0);
  });
});
