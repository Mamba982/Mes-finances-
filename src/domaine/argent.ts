/**
 * Montants : toujours en cents entiers (number). Jamais de calcul sur des dollars en virgule flottante.
 * Les valeurs dérivées (effort mensuel, moyenne) peuvent être fractionnaires en cents ;
 * on les arrondit seulement à l'affichage ou à l'enregistrement.
 */
export type Cents = number;

/** Arrondi au cent, demi vers le haut (comme Math.round du prototype). */
export function arrondirCents(c: number): Cents {
  return Math.round(c);
}

/**
 * Convertit un texte décimal propre (« 862.31 », « -84.2 », « 5000 ») en cents, sans passer par un flottant.
 * C'est le format renvoyé par Postgres pour numeric(12,2).
 */
export function decimalVersCents(s: string | number): Cents {
  const texte = typeof s === "number" ? s.toFixed(2) : s.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(texte);
  if (!m) throw new Error(`Montant décimal invalide : « ${texte} »`);
  const [, signe, entier, frac = ""] = m;
  const deux = (frac + "00").slice(0, 2);
  const reste = frac.slice(2);
  let c = Number(entier) * 100 + Number(deux);
  if (reste && Number(reste[0]) >= 5) c += 1;
  return signe ? -c : c;
}

/** Cents → texte décimal pour Postgres (« 862.31 »). */
export function centsVersDecimal(c: Cents): string {
  if (!Number.isInteger(c)) throw new Error("Les cents doivent être entiers avant l'enregistrement.");
  const signe = c < 0 ? "-" : "";
  const a = Math.abs(c);
  return `${signe}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/**
 * Lit un montant saisi ou venu d'un relevé : « 1 234,56 », « -84.22 », « (12,34) », « 84,22- », « 1.234,56 $ ».
 * Reprend les règles du prototype (fonction num) ; renvoie null au lieu de 0 si le texte n'est pas un montant.
 */
export function lireMontant(brut: string | number | null | undefined): Cents | null {
  if (typeof brut === "number") return Number.isFinite(brut) ? arrondirCents(brut * 100) : null;
  let s = String(brut ?? "").replace(/[\s  $]/g, "");
  if (!s) return null;
  const negatif = /^\(.*\)$/.test(s) || /-$/.test(s) || /^-/.test(s);
  s = s.replace(/[()]/g, "").replace(/-$/, "").replace(/^-/, "");
  if (/,\d{1,2}$/.test(s) && s.includes(".") && s.lastIndexOf(".") < s.lastIndexOf(",")) s = s.replace(/\./g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const c = decimalVersCents(s);
  return negatif ? -c : c;
}

const formats = new Map<string, Intl.NumberFormat>();

/** « 1 234 $ » ou « 1 234,56 $ » selon le nombre de décimales (format fr-CA). */
export function formaterMontant(c: number, decimales: 0 | 2 = 0, devise = "CAD"): string {
  const cle = `${devise}:${decimales}`;
  let f = formats.get(cle);
  if (!f) {
    f = new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: devise,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    formats.set(cle, f);
  }
  return f.format((c || 0) / 100);
}
