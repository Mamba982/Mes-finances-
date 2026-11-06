import { describe, expect, it } from "vitest";
import { masquerNumeros, NUMERO_MASQUE as M } from "@/domaine/masquage";

describe("masquage des numéros avant envoi", () => {
  it.each([
    ["VIREMENT AU COMPTE 0012345678", `VIREMENT AU COMPTE ${M}`],
    ["CARTE 4520 1234 5678 9012 ACHAT", `CARTE ${M} ACHAT`],
    ["CARTE 4520-1234-5678-9012", `CARTE ${M}`],
    ["DEPOT 12345-003-1234567 PAIE", `DEPOT ${M} PAIE`],
    ["INTERAC 4520123456789012 84,22", `INTERAC ${M} 84,22`],
    ["TEL 514 555 1234", `TEL ${M}`],
  ])("%s", (avant, apres) => expect(masquerNumeros(avant)).toBe(apres));

  it.each([
    "MAXI #8812 QUEBEC",
    "CARTE ****1234",
    "PAIEMENT 2026-10-05",
    "SOLDE 1 234 567,89",
    "TOTAL 12 345.67",
    "HYDRO-QUEBEC 2026",
    "Netflix.com",
  ])("laisse intact : %s", (texte) => expect(masquerNumeros(texte)).toBe(texte));
});
