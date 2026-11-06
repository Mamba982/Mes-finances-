"use client";

import { lignesDepuisMorceaux } from "./lignes";

/** Plafonds d'un relevé PDF lu par l'IA (taille de la demande et coût). */
export const MAX_PAGES_PDF = 10;
export const MAX_CARACTERES_PDF = 60_000;
/** En dessous, une page est considérée sans texte (document numérisé). */
const CARACTERES_MIN_PAR_PAGE = 40;

export type LecturePdf = { ok: true; pages: string[] } | { ok: false; raison: "trop-de-pages" | "sans-texte" | "trop-long" | "illisible" };

/** Extrait le texte d'un PDF dans le navigateur (pdf.js) : le fichier ne quitte pas l'appareil. */
export async function lireTextePdf(fichier: Blob): Promise<LecturePdf> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const tache = pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) });
    const doc = await tache.promise;
    if (doc.numPages > MAX_PAGES_PDF) return { ok: false, raison: "trop-de-pages" };
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const contenu = await (await doc.getPage(n)).getTextContent();
      const morceaux = contenu.items.flatMap((i) => ("str" in i ? [{ texte: i.str, x: i.transform[4] as number, y: i.transform[5] as number }] : []));
      pages.push(lignesDepuisMorceaux(morceaux).join("\n"));
    }
    await tache.destroy();
    const total = pages.reduce((s, p) => s + p.replace(/\s/g, "").length, 0);
    if (total < CARACTERES_MIN_PAR_PAGE * pages.length) return { ok: false, raison: "sans-texte" };
    if (pages.reduce((s, p) => s + p.length, 0) > MAX_CARACTERES_PDF) return { ok: false, raison: "trop-long" };
    return { ok: true, pages };
  } catch {
    return { ok: false, raison: "illisible" };
  }
}
