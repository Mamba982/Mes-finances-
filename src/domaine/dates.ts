/** Dates sans fuseau : « AAAA-MM-JJ » (jour) et « AAAA-MM » (mois). Aucune lecture de l'horloge ici. */
export type DateISO = string;
export type Mois = string;

const pad = (n: number) => String(n).padStart(2, "0");

function parties(d: DateISO): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) throw new Error(`Date invalide : « ${d} »`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function estDateISO(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export function moisDe(d: DateISO): Mois {
  return d.slice(0, 7);
}

export function ajouterMois(ym: Mois, k: number): Mois {
  const [a, m] = ym.split("-").map(Number) as [number, number];
  const t = a * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${pad((t % 12 + 12) % 12 + 1)}`;
}

/** Premier jour du mois, k mois après le mois de la date. */
export function premierDuMois(d: DateISO, k = 0): DateISO {
  return `${ajouterMois(moisDe(d), k)}-01`;
}

/** Différence en mois calendaires, jours ignorés (règle du prototype). */
export function moisEntre(depuis: DateISO, jusqua: DateISO): number {
  const [a1, m1] = parties(depuis);
  const [a2, m2] = parties(jusqua);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function joursEntre(a: DateISO, b: DateISO): number {
  const [y1, m1, j1] = parties(a);
  const [y2, m2, j2] = parties(b);
  return Math.round((Date.UTC(y2, m2 - 1, j2) - Date.UTC(y1, m1 - 1, j1)) / 86_400_000);
}

export function ajouterJours(d: DateISO, k: number): DateISO {
  const [y, m, j] = parties(d);
  const x = new Date(Date.UTC(y, m - 1, j + k));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** Date du jour dans le fuseau de l'appareil (à appeler dans l'interface, jamais dans le domaine). */
export function aujourdhuiLocal(maintenant = new Date()): DateISO {
  return `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())}`;
}

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const NOMS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juill.", "août", "sept.", "oct.", "nov.", "déc."];

/** « Novembre 2026 » */
export function libelleMois(ym: Mois): string {
  const [a, m] = ym.split("-").map(Number) as [number, number];
  const n = NOMS_MOIS[m - 1]!;
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`;
}

export function libelleMoisCourt(ym: Mois): string {
  return NOMS_COURTS[Number(ym.slice(5, 7)) - 1]!.replace(".", "");
}

/** « 4 nov. 2026 » ou « 4 nov. » */
export function libelleDate(d: DateISO, avecAnnee = true): string {
  const [a, m, j] = parties(d);
  const court = NOMS_COURTS[m - 1]!;
  return avecAnnee ? `${j} ${court} ${a}` : `${j} ${court}`;
}
