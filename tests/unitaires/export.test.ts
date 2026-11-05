import { describe, expect, it } from "vitest";
import { montantCsv, nomFichier, versCsv } from "@/domaine/export";

describe("export CSV", () => {
  it("marque UTF-8, séparateur « ; », fins de ligne CRLF", () => {
    expect(versCsv(["Date", "Montant"], [["2026-10-05", "-84,22"]])).toBe("﻿Date;Montant\r\n2026-10-05;-84,22\r\n");
  });
  it("met entre guillemets ce qui contient « ; », guillemets ou retours de ligne", () => {
    expect(versCsv(["A"], [['Resto "Chez Lou"; terrasse'], ["deux\nlignes"]])).toBe('﻿A\r\n"Resto ""Chez Lou""; terrasse"\r\n"deux\nlignes"\r\n');
  });
  it("vide pour null, oui/non pour les booléens", () => {
    expect(versCsv(["a", "b", "c"], [[null, true, false]])).toBe("﻿a;b;c\r\n;oui;non\r\n");
  });
  it("montants à virgule décimale, sans séparateur de milliers", () => {
    expect(montantCsv(123456)).toBe("1234,56");
    expect(montantCsv(-8422)).toBe("-84,22");
    expect(montantCsv(35952.38)).toBe("359,52");
  });
  it("nom de fichier daté", () => {
    expect(nomFichier("complet", "2026-11-05", "json")).toBe("mes-finances-complet-2026-11-05.json");
  });
});
