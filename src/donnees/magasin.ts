"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { centsVersDecimal, decimalVersCents, type Cents } from "@/domaine/argent";
import type { Categorie, Transaction, TypeCategorie } from "@/domaine/budget";
import { normaliserMarchand } from "@/domaine/categorisation";
import type { Priorite, Projet } from "@/domaine/projets";
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
}

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

const COLONNES_TX = "id,date,libelle_brut,marchand,montant,categorie_id,deductible,tps,tvq";
const PAGE = 1000;

let etat: Donnees = { statut: "vide", profil: null, categories: [], transactions: [], projets: [] };
const abonnes = new Set<() => void>();
const publier = (e: Donnees) => {
  etat = e;
  abonnes.forEach((f) => f());
};

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

async function lireProfil(): Promise<Profil> {
  const { data, error } = await supabaseNavigateur().from("profils").select("*").single();
  if (error) throw error;
  return schemaProfil.parse(data);
}

export async function charger(): Promise<void> {
  if (etat.statut === "vide") publier({ ...etat, statut: "chargement" });
  try {
    const [profil, categories, transactions, projets] = await Promise.all([lireProfil(), lireCategories(), lireTransactions(), lireProjets()]);
    publier({ statut: "pret", profil, categories, transactions, projets });
  } catch {
    publier({ ...etat, statut: etat.statut === "pret" ? "pret" : "erreur" });
    throw new Error("lecture");
  }
}

export function vider(): void {
  publier({ statut: "vide", profil: null, categories: [], transactions: [], projets: [] });
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
  const { error } = await supabaseNavigateur().from("transactions").delete().eq("id", id);
  if (error) throw error;
  publier({ ...etat, transactions: etat.transactions.filter((t) => t.id !== id) });
}

/** Changer la catégorie : affiché tout de suite, annulé si l'enregistrement échoue. */
export async function classer(id: string, categorieId: string | null): Promise<void> {
  const avant = etat.transactions;
  const code = categorieId ? etat.categories.find((c) => c.id === categorieId)?.code : null;
  const deductible = code === "affaires" ? true : undefined;
  publier({
    ...etat,
    transactions: avant.map((t) => (t.id === id ? { ...t, categorieId, deductible: deductible ?? t.deductible } : t)),
  });
  const { error } = await supabaseNavigateur()
    .from("transactions")
    .update({ categorie_id: categorieId, ...(deductible ? { deductible } : {}) })
    .eq("id", id);
  if (error) {
    publier({ ...etat, transactions: avant });
    throw error;
  }
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
