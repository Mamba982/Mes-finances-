import { formaterMontant, type Cents } from "./argent";
import { bilan, type Capacite, type IndexCategories, SANS_CATEGORIE, type Transaction } from "./budget";
import { ajouterMois, moisDe, type DateISO } from "./dates";
import { masquerNumeros } from "./masquage";
import { patrimoine, type Compte } from "./placements";
import type { Repartition, StatutProjet } from "./projets";

/**
 * Faits transmis à l'assistant : tous les chiffres sont calculés ici, par les fonctions du domaine,
 * et déjà formatés. Le modèle les explique ; il n'en calcule aucun. Aucun libellé de transaction
 * ni numéro de compte n'y figure (seulement des totaux par catégorie et des noms choisis par toi).
 */
export interface ResumeFinancier {
  date: DateISO;
  capacite: { parMois: string; source: "calculée sur tes relevés" | "entrée à la main" };
  mois: { mois: string; revenus: string; depenses: string; epargne: string; solde: string; principalesDepenses: { categorie: string; montant: string }[] }[];
  projets: {
    nom: string;
    cout: string;
    epargne: string;
    reste: string;
    echeance: DateISO;
    requisParMois: string;
    alloueParMois: string;
    statut: string;
    atteinteProjetee: DateISO | null;
  }[];
  ensembleProjets: { requisParMois: string; ecartAvecCapacite: string; sens: "marge" | "manque" };
  avoir: { actifs: string; dettes: string; net: string; comptes: { nom: string; type: string; solde: string }[] };
}

export const MAX_PROJETS_RESUME = 20;
export const MAX_COMPTES_RESUME = 20;

export function resumeFinancier(p: {
  aujourdhui: DateISO;
  capacite: Capacite;
  repartition: Repartition;
  transactions: readonly Transaction[];
  index: IndexCategories;
  comptes: readonly Compte[];
  libellesStatut: Record<StatutProjet, string>;
  devise?: string;
}): ResumeFinancier {
  const m = (c: Cents) => formaterMontant(Math.round(c), 2, p.devise);
  const courant = moisDe(p.aujourdhui);
  const mois = [ajouterMois(courant, -1), courant].map((ym) => {
    const b = bilan(p.transactions, ym, p.index);
    const principales = [...b.parCategorie.entries()]
      .sort((a, z) => z[1] - a[1])
      .slice(0, 6)
      .map(([id, c]) => ({ categorie: id === SANS_CATEGORIE ? "Sans catégorie" : (p.index.get(id)?.nom ?? "Sans catégorie"), montant: m(c) }));
    return { mois: ym, revenus: m(b.revenus), depenses: m(b.depenses), epargne: m(b.epargne), solde: m(b.solde), principalesDepenses: principales };
  });
  const pat = patrimoine(p.comptes);
  const r = p.repartition;
  return {
    date: p.aujourdhui,
    capacite: { parMois: m(p.capacite.valeur), source: p.capacite.source === "auto" ? "calculée sur tes relevés" : "entrée à la main" },
    mois,
    projets: r.projets.slice(0, MAX_PROJETS_RESUME).map((x) => ({
      nom: masquerNumeros(x.projet.nom),
      cout: m(x.cout),
      epargne: m(x.epargne),
      reste: m(x.reste),
      echeance: x.projet.echeance,
      requisParMois: m(x.requis),
      alloueParMois: m(x.alloue),
      statut: p.libellesStatut[x.statut],
      atteinteProjetee: x.atteinteProjetee,
    })),
    ensembleProjets: { requisParMois: m(r.totaux.requis), ecartAvecCapacite: m(Math.abs(r.ecart)), sens: r.ecart >= 0 ? "marge" : "manque" },
    avoir: {
      actifs: m(pat.actifs),
      dettes: m(pat.dettes),
      net: m(pat.net),
      comptes: p.comptes.slice(0, MAX_COMPTES_RESUME).map((c) => ({ nom: masquerNumeros(c.nom), type: c.type, solde: m(c.solde) })),
    },
  };
}
