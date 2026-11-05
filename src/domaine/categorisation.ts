import type { Cents } from "./argent";

/**
 * Classement automatique par règles, repris tel quel du prototype (RULES, autoCat, normMarchand).
 * Renvoie le code de catégorie (« epicerie », « frais »…) ou null.
 */
type Regle = readonly [RegExp, string, boolean?];

const REGLES: readonly Regle[] = [
  [/salaire|paie\b|payroll|d[ée]p[oô]t direct|direct dep|assurance[- ]emploi|\bae\b|prestation|allocation|cr[ée]dit (tps|solidarit)|\barc\b|\bcra\b|revenu qu[ée]bec/i, "salaire", true],
  [/loyer|rent\b|hydro[- ]?qu[ée]bec|[ée]nergir|assurance habitation/i, "logement"],
  [/\biga\b|metro\b|maxi\b|provigo|super ?c\b|walmart|costco|loblaw|sobeys|adonis|march[ée]|[ée]picerie|grocery|avril\b|mayrand/i, "epicerie"],
  [/restaurant|tim ?hortons|mcdonald|starbucks|subway|a&w|uber ?eats|doordash|skip ?the|pizza|caf[ée]\b|bistro/i, "restaurants"],
  [/\bstm\b|\brtc\b|opus|\bexo\b|uber(?! ?eats)|lyft|esso|shell|petro|ultramar|couche[- ]tard|communauto|bixi|saaq|stationnement|parking|via rail|orl[ée]ans/i, "transport"],
  [/vid[ée]otron|\bbell\b|rogers|fido|koodo|virgin|telus|freedom|fizz|public mobile|cogeco/i, "telecom"],
  [/netflix|spotify|disney|prime video|amazon prime|apple\.com|icloud|youtube|crave|adobe|openai|anthropic|claude\.ai|chatgpt|microsoft 365|xbox|playstation/i, "abonnements"],
  [/pharmaprix|jean coutu|uniprix|familiprix|brunet|pharmacie|dentist|clinique|optom/i, "sante"],
  [/universit|c[ée]gep|scolarit|tuition|coursera|udemy/i, "education"],
  [/frais|\bfee|service charge|int[ée]r[êe]ts?|interest|\bnsf\b|provision insuffisante|conversion|taux de change|overdraft|d[ée]couvert/i, "frais"],
  [/western union|remitly|moneygram|\bwise\b|taptap|sendwave|worldremit/i, "famille"],
  [/amazon|dollarama|canadian tire|ikea|best ?buy|winners|simons|sport ?expert|bureau en gros|staples|aliexpress|temu|shein/i, "achats"],
  [/cin[ée]ma|cineplex|spectacle|billet|ticketmaster|gym|[ée]nergie cardio|ymca/i, "loisirs"],
  [/[ée]pargne|savings|celi|tfsa|reer|rrsp|wealthsimple|questrade|placement/i, "epargne"],
];

/** Motif des frais bancaires (radar à frais). */
export const MOTIF_FRAIS =
  /frais|\bfees?\b|service charge|int[ée]r[êe]ts?|interest|\bnsf\b|provision insuffisante|conversion|taux de change|\bfx\b|cotisation annuelle|annual fee|overdraft|d[ée]couvert|p[ée]nalit/i;

export function categorieAuto(libelle: string, montant: Cents): string | null {
  for (const [re, code, entreeSeulement] of REGLES) {
    if (!re.test(libelle)) continue;
    if (entreeSeulement && montant < 0) continue;
    if (code === "salaire" && montant < 0) continue;
    if (code !== "salaire" && code !== "epargne" && montant > 0) continue;
    return code;
  }
  if (montant > 0) return "autres-revenus";
  return null;
}

/** Libellé brut → marchand lisible (« MAXI #8812 QUEBEC » → « Maxi Quebec »). */
export function normaliserMarchand(libelle: string): string {
  const s = String(libelle || "")
    .replace(/\b(achat|paiement|pmt|pos|pre-?auth|pr[ée]autoris[ée]|interac|tpv|carte|card|purchase|debit|d[ée]bit|visa|mc|mastercard|retrait|withdrawal|op[ée]ration|transaction)\b/gi, " ")
    .replace(/[#*]\S*/g, " ")
    .replace(/\b\d[\d\-/.:]*\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let w = s.split(" ").slice(0, 3).join(" ");
  if (!w) w = String(libelle || "").slice(0, 24);
  return w.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
