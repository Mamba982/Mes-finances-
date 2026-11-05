import { describe, expect, it } from "vitest";
import { cleDoublon, empreintes, marquerDoublons, mots, similarite } from "@/domaine/doublons";
import { transactionsReleves } from "./aides";

const l = (date: string, libelle: string, montant: number) => ({ date, libelle, montant });

describe("mots et similarité (Jaccard)", () => {
  it("garde les mots de plus de 2 lettres, sans les nombres", () => {
    expect(mots("MAXI #8812 QC Québec")).toEqual(["maxi", "québec"]);
  });
  it("calcule intersection ÷ union", () => {
    expect(similarite("MAXI #8812 QUEBEC", "MAXI 8812 QC")).toBe(0.5);
    expect(similarite("IGA EXTRA", "METRO PLUS")).toBe(0);
  });
  it("clé = date | montant | mots", () => {
    expect(cleDoublon(l("2026-10-05", "MAXI #8812 QUEBEC", -8422))).toBe("2026-10-05|-84.22|maxi quebec");
  });
});

describe("marquer les doublons", () => {
  const base = [l("2026-11-03", "MAXI #8812 QUEBEC", -9150)];

  it("même date, montant et libellé normalisé : doublon exact", () => {
    expect(marquerDoublons([l("2026-11-03", "Maxi 8812 Quebec", -9150)], base)).toEqual(["exact"]);
  });
  it("même montant, 2 jours d'écart, libellés semblables : doublon probable", () => {
    expect(marquerDoublons([l("2026-11-05", "MAXI 8812 QC", -9150)], base)).toEqual(["probable"]);
  });
  it("même marchand normalisé suffit, même avec un libellé peu semblable", () => {
    expect(marquerDoublons([l("2026-11-01", "ACHAT MAXI QUEBEC", -9150)], base)).toEqual(["probable"]);
  });
  it("4 jours d'écart : pas un doublon", () => {
    expect(marquerDoublons([l("2026-11-07", "MAXI 8812 QC", -9150)], base)).toEqual([null]);
  });
  it("montant différent d'un cent : pas un doublon", () => {
    expect(marquerDoublons([l("2026-11-03", "MAXI #8812 QUEBEC", -9151)], base)).toEqual([null]);
  });
  it("réimporter tout le relevé : 55 doublons exacts", () => {
    const t = transactionsReleves();
    expect(marquerDoublons(t, t).every((s) => s === "exact")).toBe(true);
  });
  it("deux lignes identiques dans le même fichier : la seconde est signalée (décochée par défaut)", () => {
    const r = marquerDoublons([l("2026-10-15", "TIM HORTONS #2231", -1250), l("2026-10-15", "TIM HORTONS #2231", -1250)], []);
    expect(r).toEqual([null, "exact"]);
  });
});

describe("empreintes enregistrées en base", () => {
  it("sont identiques d'un import à l'autre du même fichier", async () => {
    const t = transactionsReleves();
    expect(await empreintes(t)).toEqual(await empreintes(t));
  });
  it("distinguent deux achats identiques le même jour", async () => {
    const [a, b] = await empreintes([l("2026-10-15", "TIM HORTONS", -1250), l("2026-10-15", "TIM HORTONS", -1250)]);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
  it("un relevé qui chevauche le précédent retrouve les mêmes empreintes pour les lignes communes", async () => {
    const t = transactionsReleves();
    const complet = await empreintes(t);
    const octobre = t.filter((x) => x.date.startsWith("2026-10"));
    const partiel = await empreintes(octobre);
    const indices = t.map((x, i) => (x.date.startsWith("2026-10") ? i : -1)).filter((i) => i >= 0);
    expect(partiel).toEqual(indices.map((i) => complet[i]));
  });
});
