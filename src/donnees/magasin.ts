"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { centsVersDecimal, decimalVersCents, type Cents } from "@/domaine/argent";
import type { Categorie, Transaction, TypeCategorie } from "@/domaine/budget";
import { normaliserMarchand } from "@/domaine/categorisation";
import { prochainNumero, type Facture, type StatutFacture } from "@/domaine/factures";
import { TYPES_COMPTE, type Compte, type TypeCompte } from "@/domaine/placements";
import type { Priorite, Projet } from "@/domaine/projets";
import { motifDepuisLibelle, regleApplicable, type RegleCategorie } from "@/domaine/regles";
import { effacerInstantanes, ecrireInstantane, lireInstantane } from "./cache-local";
import { schemaProfil, type Profil } from "./profil";
import { supabaseNavigateur } from "./supabase-navigateur";

/**
 * Données de l'utilisateur connecté, chargées une fois puis tenues à jour après chaque écriture.
 * Chaque requête passe par la RLS : le navigateur ne peut lire ou écrire que les lignes de l'utilisateur.
 */
export interface Donnees {
  statut: "vide" | "chargement" | "pret" | "erreur";
  profil: Profil | null;
  categories: Categorie[];
  transactions: Transaction[];
  projets: Projet[];
  factures: Facture[];
  comptes: Compte[];
  regles: RegleCategorie[];
  /** Données affichées depuis la copie locale (hors ligne ou en attente du réseau) : date de la copie. */
  copieDu: string | null;
  horsLigne: boolean;
}

type Contenu = Omit<Donnees, "statut" | "copieDu" | "horsLigne">;

const montant = z.union([z.string(), z.number()]).transform((v) => decimalVersCents(v));

const schemaCategorie = z
  .object({
    id: z.uuid(),
    code: z.string().nullable(),
    nom: z.string(),
    type: z.enum(["revenu", "depense", "epargne"]),
    budget_mensuel: montant,
  })
  .transform((c): Categorie => ({ id: c.id, code: c.code, nom: c.nom, type: c.type, budget: c.budget_mensuel }));

const schemaTransaction = z
  .object({
    id: z.uuid(),
    date: z.string(),
    libelle_brut: z.string(),
    marchand: z.string(),
    montant,
    categorie_id: z.uuid().nullable(),
    deductible: z.boolean(),
    tps: montant,
    tvq: montant,
    recu_chemin: z.string().nullable(),
    facture_id: z.uuid().nullable(),
  })
  .transform(
    (t): Transaction => ({
      id: t.id,
      date: t.date,
      libelle: t.libelle_brut,
      marchand: t.marchand,
      montant: t.montant,
      categorieId: t.categorie_id,
      deductible: t.deductible,
      tps: t.tps,
      tvq: t.tvq,
      recuChemin: t.recu_chemin,
      factureId: t.facture_id,
    }),
  );

const schemaFacture = z
  .object({
    id: z.uuid(),
    numero: z.string(),
    client: z.string(),
    courriel: z.string().nullable(),
    description: z.string(),
    montant_ht: montant,
    taxable: z.boolean(),
    taux_tps: z.union([z.string(), z.number()]).transform(Number),
    taux_tvq: z.union([z.string(), z.number()]).transform(Number),
    tps: montant,
    tvq: montant,
    date_facture: z.string(),
    echeance: z.string().nullable(),
    statut: z.enum(["brouillon", "envoyee", "payee"]),
    date_paiement: z.string().nullable(),
  })
  .transform(
    (f): Facture => ({
      id: f.id,
      numero: f.numero,
      client: f.client,
      courriel: f.courriel,
      description: f.description,
      montantHt: f.montant_ht,
      taxable: f.taxable,
      tauxTps: f.taux_tps,
      tauxTvq: f.taux_tvq,
      tps: f.tps,
      tvq: f.tvq,
      date: f.date_facture,
      echeance: f.echeance,
      statut: f.statut,
      datePaiement: f.date_paiement,
    }),
  );

const schemaProjet = z
  .object({
    id: z.uuid(),
    nom: z.string(),
    cout: montant,
    montant_depart: montant,
    echeance: z.string(),
    priorite: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    notes: z.string().nullable(),
    postes_projet: z.array(z.object({ id: z.uuid(), nom: z.string(), montant, explication: z.string().nullable(), ordre: z.number() })),
    versements: z.array(z.object({ id: z.uuid(), montant, date: z.string(), note: z.string().nullable() })),
  })
  .transform(
    (p): Projet => ({
      id: p.id,
      nom: p.nom,
      cout: p.cout,
      montantDepart: p.montant_depart,
      echeance: p.echeance,
      priorite: p.priorite,
      notes: p.notes,
      postes: [...p.postes_projet].sort((a, b) => a.ordre - b.ordre).map(({ id, nom, montant, explication }) => ({ id, nom, montant, explication })),
      versements: [...p.versements].sort((a, b) => b.date.localeCompare(a.date)),
    }),
  );

const COLONNES_TX = "id,date,libelle_brut,marchand,montant,categorie_id,deductible,tps,tvq,recu_chemin,facture_id";
const PAGE = 1000;

const VIDE: Donnees = {
  statut: "vide",
  profil: null,
  categories: [],
  transactions: [],
  projets: [],
  factures: [],
  comptes: [],
  regles: [],
  copieDu: null,
  horsLigne: false,
};
let etat: Donnees = VIDE;
let utilisateur: string | null = null;
let attenteCopie: ReturnType<typeof setTimeout> | null = null;
const abonnes = new Set<() => void>();
const publier = (e: Donnees) => {
  etat = e;
  abonnes.forEach((f) => f());
  // Après chaque lecture ou écriture réussie, la copie locale suit (regroupée sur 1 s).
  if (e.statut === "pret" && !e.copieDu && utilisateur) {
    const id = utilisateur;
    if (attenteCopie) clearTimeout(attenteCopie);
    attenteCopie = setTimeout(() => void ecrireInstantane<Contenu>(id, contenu(etat)), 1000);
  }
};
const contenu = (e: Donnees): Contenu => ({
  profil: e.profil,
  categories: e.categories,
  transactions: e.transactions,
  projets: e.projets,
  factures: e.factures,
  comptes: e.comptes,
  regles: e.regles,
});

export function useDonnees(): Donnees {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
    () => etat,
  );
}

async function lireTransactions(): Promise<Transaction[]> {
  const sb = supabaseNavigateur();
  const tout: Transaction[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await sb.from("transactions").select(COLONNES_TX).order("date", { ascending: false }).order("cree_le").range(de, de + PAGE - 1);
    if (error) throw error;
    tout.push(...z.array(schemaTransaction).parse(data));
    if (data.length < PAGE) return tout;
  }
}

async function lireCategories(): Promise<Categorie[]> {
  const { data, error } = await supabaseNavigateur().from("categories").select("id,code,nom,type,budget_mensuel").order("ordre").order("nom");
  if (error) throw error;
  return z.array(schemaCategorie).parse(data);
}

async function lireProjets(): Promise<Projet[]> {
  const { data, error } = await supabaseNavigateur()
    .from("projets")
    .select("id,nom,cout,montant_depart,echeance,priorite,notes,postes_projet(id,nom,montant,explication,ordre),versements(id,montant,date,note)")
    .order("cree_le");
  if (error) throw error;
  return z.array(schemaProjet).parse(data);
}

async function lireFactures(): Promise<Facture[]> {
  const { data, error } = await supabaseNavigateur()
    .from("factures")
    .select("id,numero,client,courriel,description,montant_ht,taxable,taux_tps,taux_tvq,tps,tvq,date_facture,echeance,statut,date_paiement")
    .order("date_facture", { ascending: false })
    .order("numero", { ascending: false });
  if (error) throw error;
  return z.array(schemaFacture).parse(data);
}

const schemaCompte = z
  .object({ id: z.uuid(), nom: z.string(), type: z.enum(TYPES_COMPTE as [TypeCompte, ...TypeCompte[]]), solde: montant, maj_le: z.string() })
  .transform((c): Compte => ({ id: c.id, nom: c.nom, type: c.type, solde: c.solde, majLe: c.maj_le }));

async function lireComptes(): Promise<Compte[]> {
  const { data, error } = await supabaseNavigateur().from("comptes").select("id,nom,type,solde,maj_le").order("nom");
  if (error) throw error;
  return z.array(schemaCompte).parse(data);
}

const schemaRegle = z
  .object({ id: z.uuid(), motif: z.string(), categorie_id: z.uuid(), origine: z.enum(["manuel", "auto"]) })
  .transform((r): RegleCategorie => ({ id: r.id, motif: r.motif, categorieId: r.categorie_id, origine: r.origine }));

async function lireRegles(): Promise<RegleCategorie[]> {
  const { data, error } = await supabaseNavigateur().from("regles_categorie").select("id,motif,categorie_id,origine").order("motif");
  if (error) throw error;
  return z.array(schemaRegle).parse(data);
}

async function lireProfil(): Promise<Profil> {
  const { data, error } = await supabaseNavigateur().from("profils").select("*").single();
  if (error) throw error;
  return schemaProfil.parse(data);
}

/**
 * Charge les données de l'utilisateur. La copie locale s'affiche d'abord (accueil immédiat),
 * puis le réseau la remplace. Hors ligne, la copie reste affichée avec un avis.
 */
export async function charger(idUtilisateur: string): Promise<void> {
  if (utilisateur !== idUtilisateur) etat = VIDE;
  utilisateur = idUtilisateur;
  if (etat.statut === "vide") {
    publier({ ...etat, statut: "chargement" });
    const copie = await lireInstantane<Contenu>(idUtilisateur);
    // etat a pu changer pendant la lecture (déconnexion, autre chargement) : on relit sa valeur courante.
    if (copie && (etat as Donnees).statut === "chargement") publier({ ...VIDE, ...copie.donnees, statut: "pret", copieDu: copie.enregistreLe });
  }
  // Sans réseau, inutile d'attendre les nouvelles tentatives de Supabase : la copie reste affichée.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if ((etat as Donnees).statut === "pret") publier({ ...etat, horsLigne: true });
    else publier({ ...etat, statut: "erreur" });
    return;
  }
  try {
    const [profil, categories, transactions, projets, factures, comptes, regles] = await Promise.all([
      lireProfil(),
      lireCategories(),
      lireTransactions(),
      lireProjets(),
      lireFactures(),
      lireComptes(),
      lireRegles(),
    ]);
    publier({ statut: "pret", profil, categories, transactions, projets, factures, comptes, regles, copieDu: null, horsLigne: false });
  } catch {
    if (etat.statut === "pret") publier({ ...etat, horsLigne: true });
    else publier({ ...etat, statut: "erreur" });
    throw new Error("lecture");
  }
}

export function vider(): void {
  if (attenteCopie) clearTimeout(attenteCopie);
  utilisateur = null;
  publier(VIDE);
}

/** Déconnexion : rien ne reste sur l'appareil. */
export async function oublierAppareil(): Promise<void> {
  vider();
  await effacerInstantanes();
}

async function rechargerTransactions() {
  publier({ ...etat, transactions: await lireTransactions() });
}

// ---------------------------------------------------------------- écritures

export interface SaisieTransaction {
  date: string;
  libelle: string;
  montant: Cents;
  categorieId: string | null;
  deductible: boolean;
  tps: Cents;
  tvq: Cents;
}

const versLigne = (s: SaisieTransaction) => ({
  date: s.date,
  libelle_brut: s.libelle,
  marchand: normaliserMarchand(s.libelle),
  montant: centsVersDecimal(s.montant),
  categorie_id: s.categorieId,
  deductible: s.deductible,
  tps: centsVersDecimal(s.tps),
  tvq: centsVersDecimal(s.tvq),
});

export async function ajouterTransaction(s: SaisieTransaction): Promise<void> {
  const { error } = await supabaseNavigateur().from("transactions").insert({ ...versLigne(s), source: "manuel" });
  if (error) throw error;
  await rechargerTransactions();
}

export async function modifierTransaction(id: string, s: SaisieTransaction): Promise<void> {
  const { error } = await supabaseNavigateur().from("transactions").update(versLigne(s)).eq("id", id);
  if (error) throw error;
  await rechargerTransactions();
}

export async function supprimerTransaction(id: string): Promise<void> {
  const sb = supabaseNavigateur();
  const chemin = etat.transactions.find((t) => t.id === id)?.recuChemin;
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) throw error;
  // La photo du reçu part avec la transaction (un échec ici laisse un fichier orphelin, sans donnée exposée).
  if (chemin) await sb.storage.from("recus").remove([chemin]);
  publier({ ...etat, transactions: etat.transactions.filter((t) => t.id !== id) });
}

export interface Apprentissage {
  /** Motif retenu (ou mis à jour) pour cette correction ; null si aucune règle n'a pu être retenue. */
  motif: string | null;
  /** Autres transactions encore à classer auxquelles la règle s'applique. */
  autres: string[];
}

/**
 * Changer la catégorie : affiché tout de suite, annulé si l'enregistrement échoue.
 * Une correction retient une règle (marchand → catégorie) pour les prochains imports.
 */
export async function classer(id: string, categorieId: string | null): Promise<Apprentissage> {
  const avant = etat.transactions;
  const tx = avant.find((t) => t.id === id);
  const code = categorieId ? etat.categories.find((c) => c.id === categorieId)?.code : null;
  const deductible = code === "affaires" ? true : undefined;
  publier({
    ...etat,
    transactions: avant.map((t) => (t.id === id ? { ...t, categorieId, deductible: deductible ?? t.deductible } : t)),
  });
  const sb = supabaseNavigateur();
  const { error } = await sb
    .from("transactions")
    .update({ categorie_id: categorieId, ...(deductible ? { deductible } : {}) })
    .eq("id", id);
  if (error) {
    publier({ ...etat, transactions: avant });
    throw error;
  }

  const motif = tx && categorieId ? motifDepuisLibelle(tx.libelle) : null;
  if (!motif || !categorieId) return { motif: null, autres: [] };
  // L'échec de l'apprentissage n'annule pas la correction : la catégorie est déjà enregistrée.
  const existante = etat.regles.find((r) => r.motif === motif);
  const r = existante
    ? await sb.from("regles_categorie").update({ categorie_id: categorieId }).eq("id", existante.id)
    : await sb.from("regles_categorie").insert({ motif, categorie_id: categorieId, origine: "auto" });
  if (r.error) return { motif: null, autres: [] };
  const regles = await lireRegles();
  publier({ ...etat, regles });
  const nouvelle = regles.filter((x) => x.motif === motif);
  const autres = etat.transactions.filter((t) => t.id !== id && !t.categorieId && regleApplicable(nouvelle, t.libelle)).map((t) => t.id);
  return { motif, autres };
}

/** Classe plusieurs transactions en une opération (fonction SQL classer_transactions). */
export async function classerLot(lignes: { id: string; categorieId: string }[]): Promise<number> {
  if (!lignes.length) return 0;
  const { data, error } = await supabaseNavigateur().rpc("classer_transactions", {
    p_lignes: lignes.map((l) => ({ id: l.id, categorie_id: l.categorieId })),
  });
  if (error) throw error;
  await rechargerTransactions();
  return z.number().int().parse(data);
}

export async function ajouterRegle(motif: string, categorieId: string): Promise<void> {
  const { error } = await supabaseNavigateur().from("regles_categorie").insert({ motif, categorie_id: categorieId, origine: "manuel" });
  if (error) throw error;
  publier({ ...etat, regles: await lireRegles() });
}

export async function modifierRegle(id: string, categorieId: string): Promise<void> {
  const { error } = await supabaseNavigateur().from("regles_categorie").update({ categorie_id: categorieId }).eq("id", id);
  if (error) throw error;
  publier({ ...etat, regles: await lireRegles() });
}

export async function supprimerRegle(id: string): Promise<void> {
  const { error } = await supabaseNavigateur().from("regles_categorie").delete().eq("id", id);
  if (error) throw error;
  publier({ ...etat, regles: etat.regles.filter((r) => r.id !== id) });
}

export async function modifierIa(active: boolean): Promise<void> {
  const { error } = await supabaseNavigateur().from("profils").update({ ia_active: active }).not("user_id", "is", null);
  if (error) throw error;
  publier({ ...etat, profil: await lireProfil() });
}

export interface LigneAImporter {
  date: string;
  libelle: string;
  montant: Cents;
  categorieId: string | null;
  empreinte: string;
}

export async function importer(p: {
  nomFichier: string;
  format: "csv" | "pdf" | "image" | "texte";
  lues: number;
  lignes: LigneAImporter[];
}): Promise<{ importees: number; ecartees: number }> {
  const { data, error } = await supabaseNavigateur().rpc("importer_releve", {
    p_nom_fichier: p.nomFichier.slice(0, 255),
    p_format: p.format,
    p_lues: p.lues,
    p_lignes: p.lignes.map((l) => ({
      date: l.date,
      libelle: l.libelle.slice(0, 300),
      marchand: normaliserMarchand(l.libelle),
      montant: centsVersDecimal(l.montant),
      categorie_id: l.categorieId ?? "",
      empreinte: l.empreinte,
    })),
  });
  if (error) throw error;
  const r = z.object({ importees: z.number().int(), ecartees: z.number().int() }).parse(data);
  await rechargerTransactions();
  return r;
}

export async function enregistrerCategories(
  modifs: { id: string; nom: string; budget: Cents }[],
  nouvelle: { nom: string; type: TypeCategorie } | null,
): Promise<void> {
  const sb = supabaseNavigateur();
  const actuelles = new Map(etat.categories.map((c) => [c.id, c]));
  const lignes = modifs.map((m, i) => {
    const c = actuelles.get(m.id)!;
    return { id: m.id, code: c.code, nom: m.nom, type: c.type, budget_mensuel: centsVersDecimal(m.budget), ordre: i + 1 };
  });
  if (nouvelle) lignes.splice(lignes.length - 1, 0, { id: crypto.randomUUID(), code: null, nom: nouvelle.nom, type: nouvelle.type, budget_mensuel: "0.00", ordre: lignes.length });
  const { error } = await sb.from("categories").upsert(lignes);
  if (error) throw error;
  publier({ ...etat, categories: await lireCategories() });
}

// ---------------------------------------------------------------- projets

export interface SaisieProjet {
  nom: string;
  cout: Cents;
  montantDepart: Cents;
  echeance: string;
  priorite: Priorite;
  notes: string | null;
}

async function rechargerProjets() {
  publier({ ...etat, projets: await lireProjets() });
}

const verifier = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};

const ligneProjet = (s: SaisieProjet) => ({
  nom: s.nom,
  cout: centsVersDecimal(s.cout),
  montant_depart: centsVersDecimal(s.montantDepart),
  echeance: s.echeance,
  priorite: s.priorite,
  notes: s.notes,
});

export async function creerProjet(s: SaisieProjet): Promise<string> {
  const { data, error } = await supabaseNavigateur().from("projets").insert(ligneProjet(s)).select("id").single();
  if (error) throw error;
  await rechargerProjets();
  return z.object({ id: z.uuid() }).parse(data).id;
}

export async function modifierProjet(id: string, s: SaisieProjet): Promise<void> {
  verifier(await supabaseNavigateur().from("projets").update(ligneProjet(s)).eq("id", id));
  await rechargerProjets();
}

export async function changerCoutProjet(id: string, cout: Cents): Promise<void> {
  verifier(await supabaseNavigateur().from("projets").update({ cout: centsVersDecimal(cout) }).eq("id", id));
  await rechargerProjets();
}

export async function supprimerProjet(id: string): Promise<void> {
  verifier(await supabaseNavigateur().from("projets").delete().eq("id", id));
  publier({ ...etat, projets: etat.projets.filter((p) => p.id !== id) });
}

export async function ajouterVersement(projetId: string, montant: Cents, date: string): Promise<void> {
  verifier(await supabaseNavigateur().from("versements").insert({ projet_id: projetId, montant: centsVersDecimal(montant), date }));
  await rechargerProjets();
}

export async function supprimerVersement(id: string): Promise<void> {
  verifier(await supabaseNavigateur().from("versements").delete().eq("id", id));
  await rechargerProjets();
}

export async function ajouterPoste(projetId: string, nom: string, montant: Cents, explication: string | null): Promise<void> {
  const ordre = (etat.projets.find((p) => p.id === projetId)?.postes.length ?? 0) + 1;
  verifier(
    await supabaseNavigateur().from("postes_projet").insert({ projet_id: projetId, nom, montant: centsVersDecimal(montant), explication, ordre }),
  );
  await rechargerProjets();
}

export async function supprimerPoste(id: string): Promise<void> {
  verifier(await supabaseNavigateur().from("postes_projet").delete().eq("id", id));
  await rechargerProjets();
}

/** Applique un scénario en une seule opération (fonction SQL appliquer_scenario). */
export async function appliquerScenario(projets: { id: string; echeance: string; cout: Cents }[], capacite: Cents | null): Promise<void> {
  verifier(
    await supabaseNavigateur().rpc("appliquer_scenario", {
      p_projets: projets.map((p) => ({ id: p.id, echeance: p.echeance, cout: centsVersDecimal(p.cout) })),
      p_capacite: capacite === null ? null : centsVersDecimal(capacite),
    }),
  );
  const [profil, projetsAJour] = await Promise.all([lireProfil(), lireProjets()]);
  publier({ ...etat, profil, projets: projetsAJour });
}

export async function modifierCapacite(mode: "auto" | "manuel", manuelle: Cents): Promise<void> {
  verifier(
    await supabaseNavigateur().from("profils").update({ mode_capacite: mode, capacite_manuelle: centsVersDecimal(manuelle) }).not("user_id", "is", null),
  );
  publier({ ...etat, profil: await lireProfil() });
}

// ---------------------------------------------------------------- affaires

export interface SaisieFacture {
  client: string;
  courriel: string | null;
  description: string;
  montantHt: Cents;
  taxable: boolean;
  date: string;
  echeance: string | null;
}

const ligneFacture = (s: SaisieFacture) => ({
  client: s.client,
  courriel: s.courriel,
  description: s.description,
  montant_ht: centsVersDecimal(s.montantHt),
  taxable: s.taxable,
  date_facture: s.date,
  echeance: s.echeance,
});

async function rechargerFactures() {
  publier({ ...etat, factures: await lireFactures() });
}

/**
 * Crée une facture avec le prochain numéro de son année. Les taux de taxes du profil y sont copiés ;
 * la base calcule TPS et TVQ. Si un autre appareil a pris le même numéro, on recalcule une fois.
 */
export async function creerFacture(s: SaisieFacture, statut: "brouillon" | "envoyee" = "brouillon"): Promise<void> {
  const sb = supabaseNavigateur();
  const annee = Number(s.date.slice(0, 4));
  for (let essai = 0; essai < 2; essai++) {
    const numeros = essai === 0 ? etat.factures.map((f) => f.numero) : (await lireFactures()).map((f) => f.numero);
    const { error } = await sb.from("factures").insert({
      ...ligneFacture(s),
      statut,
      numero: prochainNumero(numeros, annee),
      taux_tps: String(etat.profil?.taux_tps ?? 5),
      taux_tvq: String(etat.profil?.taux_tvq ?? 9.975),
    });
    if (!error) return rechargerFactures();
    if (error.code !== "23505") throw error;
  }
  throw new Error("numéro de facture");
}

export async function modifierFacture(id: string, s: SaisieFacture): Promise<void> {
  verifier(await supabaseNavigateur().from("factures").update(ligneFacture(s)).eq("id", id));
  await rechargerFactures();
}

/** Brouillon ↔ envoyée par une mise à jour ; « payée » seulement par la fonction SQL qui crée le revenu. */
export async function changerStatutFacture(id: string, statut: StatutFacture, datePaiement: string): Promise<void> {
  const sb = supabaseNavigateur();
  if (statut === "payee") verifier(await sb.rpc("marquer_facture_payee", { p_facture: id, p_date: datePaiement }));
  else verifier(await sb.from("factures").update({ statut }).eq("id", id));
  const [factures, transactions] = await Promise.all([lireFactures(), lireTransactions()]);
  publier({ ...etat, factures, transactions });
}

export async function supprimerFacture(id: string): Promise<void> {
  verifier(await supabaseNavigateur().from("factures").delete().eq("id", id));
  const [factures, transactions] = await Promise.all([lireFactures(), lireTransactions()]);
  publier({ ...etat, factures, transactions });
}

export interface SaisieRecu {
  date: string;
  marchand: string;
  description: string;
  total: Cents;
  tps: Cents;
  tvq: Cents;
  categorieId: string | null;
}

/**
 * Ajoute un reçu comme dépense déductible. La photo, si fournie, va dans le dossier privé de
 * l'utilisateur ; si l'enregistrement de la dépense échoue, la photo est retirée.
 */
export async function ajouterRecu(s: SaisieRecu, photo: Blob | null): Promise<void> {
  const sb = supabaseNavigateur();
  let chemin: string | null = null;
  if (photo) {
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) throw new Error("session");
    chemin = `${uid}/${crypto.randomUUID()}.jpg`;
    verifier(await sb.storage.from("recus").upload(chemin, photo, { contentType: "image/jpeg", upsert: false }));
  }
  const libelle = s.description ? `${s.marchand} : ${s.description}` : s.marchand;
  const { error } = await sb.from("transactions").insert({
    date: s.date,
    libelle_brut: libelle.slice(0, 300),
    marchand: normaliserMarchand(s.marchand),
    montant: centsVersDecimal(-Math.abs(s.total)),
    categorie_id: s.categorieId,
    source: "recu",
    deductible: true,
    tps: centsVersDecimal(s.tps),
    tvq: centsVersDecimal(s.tvq),
    recu_chemin: chemin,
  });
  if (error) {
    if (chemin) await sb.storage.from("recus").remove([chemin]);
    throw error;
  }
  await rechargerTransactions();
}

/** Lien temporaire (2 minutes) vers la photo d'un reçu. */
export async function lienRecu(chemin: string): Promise<string> {
  const { data, error } = await supabaseNavigateur().storage.from("recus").createSignedUrl(chemin, 120);
  if (error) throw error;
  return data.signedUrl;
}

export interface SaisieProfilAffaires {
  entreprise_nom: string | null;
  entreprise_adresse: string | null;
  no_tps: string | null;
  no_tvq: string | null;
  taux_tps: number;
  taux_tvq: number;
  frais_carte_pct: number;
  frais_carte_fixe: Cents;
  frais_interac: Cents;
  frais_change_pct: number;
  abonnement_compte_us: Cents;
}

export async function modifierProfilAffaires(s: SaisieProfilAffaires): Promise<void> {
  verifier(
    await supabaseNavigateur()
      .from("profils")
      .update({
        ...s,
        taux_tps: String(s.taux_tps),
        taux_tvq: String(s.taux_tvq),
        frais_carte_pct: String(s.frais_carte_pct),
        frais_carte_fixe: centsVersDecimal(s.frais_carte_fixe),
        frais_interac: centsVersDecimal(s.frais_interac),
        frais_change_pct: String(s.frais_change_pct),
        abonnement_compte_us: centsVersDecimal(s.abonnement_compte_us),
      })
      .not("user_id", "is", null),
  );
  publier({ ...etat, profil: await lireProfil() });
}

// ---------------------------------------------------------------- comptes

export interface SaisieCompte {
  nom: string;
  type: TypeCompte;
  solde: Cents;
}

export async function enregistrerCompte(id: string | null, s: SaisieCompte, aujourdhui: string): Promise<void> {
  const ligne = { nom: s.nom, type: s.type, solde: centsVersDecimal(Math.abs(s.solde)), maj_le: aujourdhui };
  const sb = supabaseNavigateur();
  verifier(id ? await sb.from("comptes").update(ligne).eq("id", id) : await sb.from("comptes").insert(ligne));
  publier({ ...etat, comptes: await lireComptes() });
}

export async function supprimerCompte(id: string): Promise<void> {
  verifier(await supabaseNavigateur().from("comptes").delete().eq("id", id));
  publier({ ...etat, comptes: etat.comptes.filter((c) => c.id !== id) });
}
