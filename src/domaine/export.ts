import { centsVersDecimal, type Cents } from "./argent";

/**
 * Fichiers d'export (Loi 25 : portabilité). CSV pour Excel en français :
 * séparateur « ; », virgule décimale, marque UTF-8 en tête, guillemets au besoin.
 */
export type Cellule = string | number | boolean | null | undefined;

function cellule(v: Cellule): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(entete: readonly string[], lignes: readonly (readonly Cellule[])[]): string {
  return "﻿" + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}

/** 123456 → « 1234,56 » (sans séparateur de milliers : Excel le relit comme un nombre). */
export function montantCsv(c: Cents): string {
  return centsVersDecimal(Math.round(c)).replace(".", ",");
}

export function nomFichier(base: string, aujourdhui: string, extension: "json" | "csv"): string {
  return `mes-finances-${base}-${aujourdhui}.${extension}`;
}
