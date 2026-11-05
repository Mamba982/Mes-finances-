"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { centsVersDecimal, decimalVersCents, type Cents } from "@/domaine/argent";
import type { Categorie, Transaction, TypeCategorie } from "@/domaine/budget";
import { normaliserMarchand } from "@/domaine/categorisation";
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

const COLONNES_TX = "id,date,libelle_brut,marchand,montant,categorie_id,deductible,tps,tvq";
const PAGE = 1000;

let etat: Donnees = { statut: "vide", profil: null, categories: [], transactions: [] };
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

export async function charger(): Promise<void> {
  if (etat.statut === "vide") publier({ ...etat, statut: "chargement" });
  try {
    const sb = supabaseNavigateur();
    const [p, categories, transactions] = await Promise.all([sb.from("profils").select("*").single(), lireCategories(), lireTransactions()]);
    if (p.error) throw p.error;
    publier({ statut: "pret", profil: schemaProfil.parse(p.data), categories, transactions });
  } catch {
    publier({ ...etat, statut: etat.statut === "pret" ? "pret" : "erreur" });
    throw new Error("lecture");
  }
}

export function vider(): void {
  publier({ statut: "vide", profil: null, categories: [], transactions: [] });
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
