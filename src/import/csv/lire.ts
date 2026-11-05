import { lireMontant, type Cents } from "@/domaine/argent";

/**
 * Lecture d'un relevé CSV sur l'appareil. Reprend l'algorithme du prototype (parseCSV) :
 * séparateur le plus fréquent parmi , ; tabulation ; en-tête reconnu par ses mots ;
 * colonnes trouvées par l'en-tête ou, à défaut, par leur contenu ; débit et crédit séparés acceptés.
 */
export interface LigneReleve {
  date: string; // AAAA-MM-JJ
  libelle: string;
  montant: Cents;
}

export interface ResultatCsv {
  lignes: LigneReleve[];
  /** Lignes de données lues (en-tête exclu). */
  lues: number;
  separateur: "," | ";" | "\t";
  ordreDates: "AMJ" | "MJA" | "JMA";
}

const pad = (s: string) => s.padStart(2, "0");

export function decouperLigne(ligne: string, sep: string): string[] {
  const sortie: string[] = [];
  let cur = "";
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i]!;
    if (guillemets) {
      if (ch === '"') {
        if (ligne[i + 1] === '"') {
          cur += '"';
          i++;
        } else guillemets = false;
      } else cur += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) {
      sortie.push(cur);
      cur = "";
    } else cur += ch;
  }
  sortie.push(cur);
  return sortie.map((s) => s.trim());
}

export function ressembleDate(s: string): boolean {
  return /^\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*$/.test(s) || /^\d{8}$/.test(s);
}

export function ressembleMontant(s: string): boolean {
  return /^\s*[-(]?\s*\$?\s*-?[\d\s ]+([.,]\d{1,2})?\s*\$?\s*\)?-?\s*$/.test(s) && /\d/.test(s);
}

/** JJ/MM si un premier nombre dépasse 12 dans la colonne ; sinon MM/JJ (règle du prototype). */
export function lecteurDates(valeurs: readonly string[]): { lire: (v: string) => string | null; ordre: "MJA" | "JMA" } {
  let ordre: "MJA" | "JMA" = "MJA";
  for (const v of valeurs) {
    const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(v);
    if (m && Number(m[1]) > 12) ordre = "JMA";
  }
  const lire = (brut: string): string | null => {
    const v = brut.trim();
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
    if (m) return `${m[1]}-${pad(m[2]!)}-${pad(m[3]!)}`;
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(v);
    if (m) {
      const a = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
      return ordre === "JMA" ? `${a}-${pad(m[2]!)}-${pad(m[1]!)}` : `${a}-${pad(m[1]!)}-${pad(m[2]!)}`;
    }
    return null;
  };
  return { lire, ordre };
}

const MOTS_ENTETE = /date|description|libell|montant|amount|d[ée]bit|cr[ée]dit|transaction/;

export function lireCsv(texte: string): ResultatCsv {
  const lignesTexte = String(texte)
    .replace(/^﻿/, "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim());
  const vide: ResultatCsv = { lignes: [], lues: 0, separateur: ",", ordreDates: "AMJ" };
  if (!lignesTexte.length) return vide;

  const echantillon = lignesTexte.slice(0, 10).join("\n");
  const separateur = ([",", ";", "\t"] as const)
    .map((c) => [c, echantillon.split(c).length] as const)
    .sort((a, b) => b[1] - a[1])[0]![0];

  const rangees = lignesTexte.map((l) => decouperLigne(l, separateur));
  const h = rangees[0]!.map((x) => x.toLowerCase());
  const aEntete = !h.some(ressembleDate) && h.some((x) => MOTS_ENTETE.test(x));
  const corps = aEntete ? rangees.slice(1) : rangees;
  if (!corps.length) return { ...vide, separateur };

  const idx = { date: -1, desc: -1, mt: -1, deb: -1, cre: -1 };
  if (aEntete) {
    h.forEach((x, i) => {
      if (idx.date < 0 && /date/.test(x)) idx.date = i;
      else if (idx.desc < 0 && /descr|libell|d[ée]tail|marchand|merchant|payee|b[ée]n[ée]ficiaire|nom|name|memo/.test(x)) idx.desc = i;
      else if (idx.deb < 0 && /d[ée]bit|retrait|withdraw|sortie|paid out/.test(x)) idx.deb = i;
      else if (idx.cre < 0 && /cr[ée]dit|d[ée]p[oô]t|deposit|entr[ée]e|paid in/.test(x)) idx.cre = i;
      else if (idx.mt < 0 && /montant|amount|valeur|cad\$/.test(x)) idx.mt = i;
    });
  }
  const ncol = Math.max(...corps.map((r) => r.length));
  const cell = (r: readonly string[], c: number) => r[c] ?? "";

  if (idx.date < 0) {
    for (let c = 0; c < ncol; c++) {
      if (corps.filter((r) => ressembleDate(cell(r, c))).length >= corps.length * 0.6) {
        idx.date = c;
        break;
      }
    }
  }
  if (idx.desc < 0) {
    let meilleur = -1;
    let longueur = 0;
    for (let c = 0; c < ncol; c++) {
      if (c === idx.date) continue;
      const L = corps.reduce((a, r) => {
        const v = cell(r, c);
        return a + (ressembleMontant(v) || ressembleDate(v) ? 0 : v.length);
      }, 0);
      if (L > longueur) {
        longueur = L;
        meilleur = c;
      }
    }
    idx.desc = meilleur;
  }
  if (idx.mt < 0 && idx.deb < 0) {
    const numeriques: number[] = [];
    for (let c = 0; c < ncol; c++) {
      if (c === idx.date || c === idx.desc) continue;
      if (corps.some((r) => ressembleMontant(cell(r, c)))) numeriques.push(c);
    }
    let paire: [number, number] | null = null;
    for (let i = 0; i < numeriques.length && !paire; i++) {
      for (let j = i + 1; j < numeriques.length; j++) {
        const A = numeriques[i]!;
        const B = numeriques[j]!;
        const lesDeux = corps.some((r) => ressembleMontant(cell(r, A)) && ressembleMontant(cell(r, B)));
        const couverture = corps.filter((r) => ressembleMontant(cell(r, A)) || ressembleMontant(cell(r, B))).length;
        if (!lesDeux && couverture >= corps.length * 0.8) {
          paire = [A, B];
          break;
        }
      }
    }
    if (paire) [idx.deb, idx.cre] = paire;
    else if (numeriques.length) idx.mt = numeriques[0]!;
  }
  if (idx.date < 0 || (idx.mt < 0 && idx.deb < 0)) return { ...vide, separateur, lues: corps.length };

  const { lire, ordre } = lecteurDates(corps.map((r) => cell(r, idx.date)));
  const lignes: LigneReleve[] = [];
  for (const r of corps) {
    const date = lire(cell(r, idx.date));
    if (!date) continue;
    let montant: Cents;
    if (idx.mt >= 0) montant = lireMontant(cell(r, idx.mt)) ?? 0;
    else {
      const a = lireMontant(cell(r, idx.deb) || "0") ?? 0;
      const b = idx.cre >= 0 ? (lireMontant(cell(r, idx.cre) || "0") ?? 0) : 0;
      montant = Math.abs(b) - Math.abs(a);
    }
    if (!montant) continue;
    const libelle = (idx.desc >= 0 ? cell(r, idx.desc) : "") || "Transaction";
    lignes.push({ date, libelle, montant });
  }
  const amj = corps.some((r) => /^\d{4}/.test(cell(r, idx.date).trim()));
  return { lignes, lues: corps.length, separateur, ordreDates: amj ? "AMJ" : ordre };
}
