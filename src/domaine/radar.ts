import type { Cents } from "./argent";
import { codeDe, typeDe, type IndexCategories, type Transaction } from "./budget";
import { MOTIF_FRAIS, normaliserMarchand } from "./categorisation";
import { ajouterMois, moisDe, type DateISO } from "./dates";

export type TypeFrais = "Frais de change" | "Intérêts" | "Provision insuffisante" | "Frais de compte et autres";

export interface Recurrent {
  nom: string;
  mensuel: Cents;
  annuel: Cents;
  nbMois: number;
}

export interface Radar {
  frais: Transaction[];
  totalFrais: Cents;
  parType: Partial<Record<TypeFrais, Cents>>;
  recurrents: Recurrent[];
  totalRecurrents: Cents;
}

const EXCLUS_RECURRENTS = new Set(["logement", "epicerie", "frais"]);

export function typeFrais(libelle: string): TypeFrais {
  if (/conversion|change|\bfx\b/i.test(libelle)) return "Frais de change";
  if (/int[ée]r[êe]t|interest/i.test(libelle)) return "Intérêts";
  if (/nsf|provision/i.test(libelle)) return "Provision insuffisante";
  return "Frais de compte et autres";
}

/** Radar sur les 12 derniers mois (mois courant inclus), sorties d'argent seulement. */
export function radar(txs: readonly Transaction[], cats: IndexCategories, aujourdhui: DateISO): Radar {
  const limite = ajouterMois(moisDe(aujourdhui), -11);
  const sorties = txs.filter((t) => moisDe(t.date) >= limite && t.montant < 0);

  const frais = sorties.filter((t) => codeDe(t, cats) === "frais" || MOTIF_FRAIS.test(t.libelle));
  const totalFrais = frais.reduce((a, t) => a - t.montant, 0);
  const parType: Partial<Record<TypeFrais, Cents>> = {};
  for (const t of frais) {
    const k = typeFrais(t.libelle);
    parType[k] = (parType[k] ?? 0) - t.montant;
  }

  const groupes = new Map<string, Transaction[]>();
  for (const t of sorties) {
    const code = codeDe(t, cats);
    if (typeDe(t, cats) !== "depense" || (code && EXCLUS_RECURRENTS.has(code))) continue;
    const k = (t.marchand || normaliserMarchand(t.libelle)).toLowerCase();
    const g = groupes.get(k);
    if (g) g.push(t);
    else groupes.set(k, [t]);
  }
  const recurrents: Recurrent[] = [];
  for (const l of groupes.values()) {
    const nbMois = new Set(l.map((t) => moisDe(t.date))).size;
    if (nbMois < 2) continue;
    const valeurs = l.map((t) => -t.montant);
    const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    const regulier = valeurs.every((v) => Math.abs(v - moyenne) <= Math.max(50, moyenne * 0.05));
    if (!regulier || l.length > nbMois + 1) continue;
    recurrents.push({ nom: l[0]!.marchand || normaliserMarchand(l[0]!.libelle), mensuel: moyenne, annuel: moyenne * 12, nbMois });
  }
  recurrents.sort((a, b) => b.annuel - a.annuel);
  return { frais, totalFrais, parType, recurrents, totalRecurrents: recurrents.reduce((a, r) => a + r.annuel, 0) };
}
