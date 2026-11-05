import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decouperLigne, lecteurDates, lireCsv } from "@/import/csv/lire";

const DOSSIER = join(import.meta.dirname, "../fixtures/releves");
const attendu = JSON.parse(readFileSync(join(DOSSIER, "attendu.json"), "utf8")) as { date: string; libelle: string; montant: number }[];
const lire = (f: string) => lireCsv(readFileSync(join(DOSSIER, f), "utf8"));

describe("relevés fictifs des 7 banques", () => {
  it.each([
    ["desjardins.csv", ",", 55],
    ["banque-nationale.csv", ";", 55],
    ["rbc.csv", ",", 55],
    ["td.csv", ",", 55],
    ["bmo.csv", ",", 57], // + ligne d'avertissement et ligne d'en-tête, lues puis écartées (ligne vide ignorée)
    ["scotia.csv", ",", 55],
    ["tangerine.csv", ",", 55],
  ])("%s : 55 transactions avec les bonnes dates, montants et libellés", (fichier, sep, lues) => {
    const r = lire(fichier);
    expect(r.separateur).toBe(sep);
    expect(r.lues).toBe(lues);
    expect(r.lignes).toHaveLength(55);
    r.lignes.forEach((l, i) => {
      expect(l.date).toBe(attendu[i]!.date);
      expect(l.montant).toBe(attendu[i]!.montant);
      expect(l.libelle).toContain(attendu[i]!.libelle);
    });
  });

  it("Banque Nationale : dates JJ/MM détectées grâce aux jours > 12", () => {
    expect(lire("banque-nationale.csv").ordreDates).toBe("JMA");
  });
  it("TD : dates MM/JJ", () => {
    expect(lire("td.csv").ordreDates).toBe("MJA");
  });
});

describe("cas particuliers", () => {
  it("ignore la marque d'ordre des octets (BOM) d'un fichier sans en-tête", () => {
    const r = lireCsv("﻿2026-10-03,MAXI,-84.22\n2026-10-04,IGA,-12.00\n");
    expect(r.lignes.map((l) => l.date)).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("lit « (12,34) » et « 1 234,56 » dans un fichier à point-virgule", () => {
    const r = lireCsv("Date;Description;Montant\n2026-10-03;Remboursement;1 234,56\n2026-10-04;Frais;(12,34)\n");
    expect(r.lignes.map((l) => l.montant)).toEqual([123456, -1234]);
  });

  it("écarte les montants nuls et les dates illisibles", () => {
    const r = lireCsv("Date,Description,Montant\n2026-10-03,A,0\nhier,B,-5\n2026-10-05,C,-5\n");
    expect(r.lues).toBe(3);
    expect(r.lignes).toEqual([{ date: "2026-10-05", libelle: "C", montant: -500 }]);
  });

  it("renvoie aucune ligne si aucune colonne de date n'existe", () => {
    expect(lireCsv("a,b\nc,d\n").lignes).toEqual([]);
  });

  it("respecte les guillemets doublés", () => {
    expect(decouperLigne('"Resto ""Chez Lou""",12', ",")).toEqual(['Resto "Chez Lou"', "12"]);
  });

  it("années à deux chiffres : 20AA", () => {
    expect(lecteurDates(["3/10/26"]).lire("3/10/26")).toBe("2026-03-10");
  });
});
