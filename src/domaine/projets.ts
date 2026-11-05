import type { Cents } from "./argent";
import { ajouterMois, moisDe, moisEntre, type DateISO, type Mois } from "./dates";

/** Règles de financement des projets, reprises du prototype (calcProjets, pireProjet). */

export type Priorite = 1 | 2 | 3;
export type Horizon = "court" | "moyen" | "long";
export type StatutProjet = "atteint" | "ok" | "retard" | "nonfinance" | "depasse";

export interface Poste {
  id: string;
  nom: string;
  montant: Cents;
  explication: string | null;
}

export interface Versement {
  id: string;
  montant: Cents; // négatif = retrait
  date: DateISO;
  note: string | null;
}

export interface Projet {
  id: string;
  nom: string;
  cout: Cents;
  montantDepart: Cents;
  echeance: DateISO;
  priorite: Priorite;
  notes: string | null;
  postes: Poste[];
  versements: Versement[];
}

export interface CalculProjet {
  projet: Projet;
  epargne: Cents; // départ + versements
  cout: Cents;
  reste: Cents;
  mois: number; // mois calendaires jusqu'à l'échéance (négatif si passée)
  horizon: Horizon;
  requis: Cents; // effort requis par mois (peut être fractionnaire)
  alloue: Cents; // part de la capacité attribuée
  pourcentage: number; // 0 à 1
  depasse: boolean;
  statut: StatutProjet;
  /** Premier jour du mois où l'objectif serait atteint au rythme alloué (null si rien n'est alloué). */
  atteinteProjetee: DateISO | null;
}

export interface TotauxHorizon {
  nombre: number;
  reste: Cents;
  requis: Cents;
}

export interface Repartition {
  projets: CalculProjet[]; // dans l'ordre d'origine
  totaux: { cout: Cents; epargne: Cents; reste: Cents; requis: Cents };
  parHorizon: Record<Horizon, TotauxHorizon>;
  capacite: Cents;
  margeRestante: Cents;
  /** Capacité − effort requis total : négatif = manque mensuel. */
  ecart: Cents;
}

/** Tolérance du statut « dans les temps » : 0,50 $ (règle du prototype). */
export const TOLERANCE_DANS_LES_TEMPS = 50;

export function horizonDe(mois: number): Horizon {
  return mois <= 12 ? "court" : mois <= 60 ? "moyen" : "long";
}

/** Effort requis par mois = reste ÷ max(1, mois restants). */
export function effortRequis(reste: Cents, mois: number): Cents {
  return reste > 0 ? reste / Math.max(1, mois) : 0;
}

export function repartir(projets: readonly Projet[], capacite: Cents, aujourdhui: DateISO): Repartition {
  const liste: CalculProjet[] = projets.map((p) => {
    const verse = p.versements.reduce((s, v) => s + v.montant, 0);
    const epargne = p.montantDepart + verse;
    const reste = Math.max(0, p.cout - epargne);
    const mois = moisEntre(aujourdhui, p.echeance);
    return {
      projet: p,
      epargne,
      cout: p.cout,
      reste,
      mois,
      horizon: horizonDe(mois),
      requis: effortRequis(reste, mois),
      alloue: 0,
      pourcentage: p.cout > 0 ? Math.min(1, epargne / p.cout) : 0,
      depasse: p.echeance < aujourdhui && reste > 0,
      statut: "nonfinance",
      atteinteProjetee: null,
    };
  });

  let reste = Math.max(0, capacite);
  [...liste]
    .filter((x) => x.reste > 0)
    .sort((a, b) => a.projet.priorite - b.projet.priorite || a.projet.echeance.localeCompare(b.projet.echeance))
    .forEach((x) => {
      x.alloue = Math.min(x.requis, reste);
      reste -= x.alloue;
    });

  for (const x of liste) {
    if (x.reste <= 0) {
      x.statut = "atteint";
      continue;
    }
    if (x.alloue > 0) {
      const k = Math.ceil(x.reste / x.alloue - 1e-9);
      x.atteinteProjetee = `${ajouterMois(moisDe(aujourdhui), k)}-01`;
    }
    x.statut = x.depasse ? "depasse" : x.alloue >= x.requis - TOLERANCE_DANS_LES_TEMPS ? "ok" : x.alloue > 0 ? "retard" : "nonfinance";
  }

  const totaux = { cout: 0, epargne: 0, reste: 0, requis: 0 };
  const parHorizon: Record<Horizon, TotauxHorizon> = {
    court: { nombre: 0, reste: 0, requis: 0 },
    moyen: { nombre: 0, reste: 0, requis: 0 },
    long: { nombre: 0, reste: 0, requis: 0 },
  };
  for (const x of liste) {
    totaux.cout += x.cout;
    totaux.epargne += Math.min(x.epargne, x.cout || x.epargne);
    totaux.reste += x.reste;
    totaux.requis += x.requis;
    const h = parHorizon[x.horizon];
    h.nombre++;
    h.reste += x.reste;
    h.requis += x.requis;
  }
  return { projets: liste, totaux, parHorizon, capacite, margeRestante: reste, ecart: capacite - totaux.requis };
}

const ORDRE_RISQUE: Record<StatutProjet, number> = { depasse: 0, nonfinance: 1, retard: 2, ok: 3, atteint: 4 };

/** Projet le plus à risque ; s'il n'y en a aucun, la prochaine échéance non atteinte. */
export function projetAAfficher(r: Repartition): { calcul: CalculProjet; aRisque: boolean } | null {
  const pire = [...r.projets].sort(
    (a, b) => ORDRE_RISQUE[a.statut] - ORDRE_RISQUE[b.statut] || a.projet.echeance.localeCompare(b.projet.echeance),
  )[0];
  if (!pire) return null;
  if (pire.statut !== "ok" && pire.statut !== "atteint") return { calcul: pire, aRisque: true };
  const prochain = r.projets.filter((x) => x.reste > 0).sort((a, b) => a.projet.echeance.localeCompare(b.projet.echeance))[0];
  return { calcul: prochain ?? pire, aRisque: false };
}

/** Ordre d'affichage de la liste : priorité, puis échéance. */
export function trierPourAffichage(r: Repartition): CalculProjet[] {
  return [...r.projets].sort((a, b) => a.projet.priorite - b.projet.priorite || a.projet.echeance.localeCompare(b.projet.echeance));
}

export interface PointEpargne {
  mois: Mois;
  prevue: Cents; // épargne cumulée prévue avec la répartition actuelle
  coutEchu: Cents; // coût des projets arrivés à échéance
}

/** Courbe sur 24 mois : épargne cumulée prévue et coût des projets échus (graphique du prototype). */
export function epargneCumulee(r: Repartition, aujourdhui: DateISO, nbMois = 24): PointEpargne[] {
  const points: PointEpargne[] = [];
  for (let i = 0; i <= nbMois; i++) {
    let prevue = r.totaux.epargne;
    let coutEchu = 0;
    for (const x of r.projets) {
      prevue += Math.min(x.reste, x.alloue * i);
      if (x.mois <= i) coutEchu += x.cout;
    }
    points.push({ mois: ajouterMois(moisDe(aujourdhui), i), prevue, coutEchu });
  }
  return points;
}

// ---------------------------------------------------------------- scénarios

export interface Scenario {
  /** Épargne mensuelle en plus (ou en moins). */
  delta: Cents;
  projets: Record<string, { echeance?: DateISO; cout?: Cents }>;
}

/** Applique un scénario à une copie : rien n'est modifié dans les projets d'origine. */
export function appliquerScenario(projets: readonly Projet[], s: Scenario): Projet[] {
  return projets.map((p) => {
    const o = s.projets[p.id];
    return o ? { ...p, echeance: o.echeance || p.echeance, cout: o.cout ?? p.cout } : { ...p };
  });
}

export function comparerScenario(projets: readonly Projet[], capacite: Cents, s: Scenario, aujourdhui: DateISO) {
  const avant = repartir(projets, capacite, aujourdhui);
  const apres = repartir(appliquerScenario(projets, s), Math.max(0, capacite + s.delta), aujourdhui);
  return { avant, apres };
}
