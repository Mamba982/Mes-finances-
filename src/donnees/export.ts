"use client";

import { decimalVersCents } from "@/domaine/argent";
import { montantCsv, versCsv } from "@/domaine/export";
import { supabaseNavigateur } from "./supabase-navigateur";

/** Tables exportées : toutes les données de l'utilisateur (la RLS limite chaque lecture à ses lignes). */
const TABLES = [
  "profils",
  "categories",
  "regles_categorie",
  "imports",
  "transactions",
  "projets",
  "postes_projet",
  "versements",
  "factures",
  "comptes",
  "usage_ia",
] as const;
const PAGE = 1000;

async function lireTout(table: string): Promise<Record<string, unknown>[]> {
  const sb = supabaseNavigateur();
  const lignes: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await sb.from(table).select("*").range(de, de + PAGE - 1);
    if (error) throw error;
    lignes.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) return lignes;
  }
}

/** Export complet (JSON) : chaque table telle qu'enregistrée, plus l'identité du compte. */
export async function exportComplet(): Promise<string> {
  const sb = supabaseNavigateur();
  const { data } = await sb.auth.getUser();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) tables[t] = await lireTout(t);
  const { data: fichiers } = data.user ? await sb.storage.from("recus").list(data.user.id, { limit: 1000 }) : { data: [] };
  return JSON.stringify(
    {
      application: "Mes finances",
      exporte_le: new Date().toISOString(),
      compte: { id: data.user?.id ?? null, courriel: data.user?.email ?? null, cree_le: data.user?.created_at ?? null },
      tables,
      photos_de_recus: (fichiers ?? []).map((f) => f.name),
    },
    null,
    2,
  );
}

const m = (v: unknown) => (v === null || v === undefined ? "" : montantCsv(decimalVersCents(v as string | number)));

/** Exports CSV lisibles dans Excel, une table à la fois. */
export async function exportCsv(nom: "transactions" | "projets" | "factures" | "comptes"): Promise<string> {
  const categories = new Map((await lireTout("categories")).map((c) => [c.id as string, c.nom as string]));
  switch (nom) {
    case "transactions":
      return versCsv(
        ["Date", "Description", "Marchand", "Montant", "Catégorie", "Déductible", "TPS", "TVQ", "Source"],
        (await lireTout("transactions"))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((t) => [t.date as string, t.libelle_brut as string, t.marchand as string, m(t.montant), categories.get(t.categorie_id as string) ?? "", Boolean(t.deductible), m(t.tps), m(t.tvq), t.source as string]),
      );
    case "projets": {
      const versements = await lireTout("versements");
      return versCsv(
        ["Projet", "Priorité", "Échéance", "Coût", "Montant de départ", "Versements", "Notes"],
        (await lireTout("projets")).map((p) => {
          const total = versements.filter((v) => v.projet_id === p.id).reduce((s, v) => s + decimalVersCents(v.montant as string | number), 0);
          return [p.nom as string, p.priorite as number, p.echeance as string, m(p.cout), m(p.montant_depart), montantCsv(total), (p.notes as string) ?? ""];
        }),
      );
    }
    case "factures":
      return versCsv(
        ["Numéro", "Client", "Courriel", "Description", "Avant taxes", "TPS", "TVQ", "Date", "Échéance", "Statut", "Payée le"],
        (await lireTout("factures")).map((f) => [
          f.numero as string,
          f.client as string,
          (f.courriel as string) ?? "",
          f.description as string,
          m(f.montant_ht),
          m(f.tps),
          m(f.tvq),
          f.date_facture as string,
          (f.echeance as string) ?? "",
          f.statut as string,
          (f.date_paiement as string) ?? "",
        ]),
      );
    case "comptes":
      return versCsv(
        ["Compte", "Type", "Solde", "Mis à jour le"],
        (await lireTout("comptes")).map((c) => [c.nom as string, c.type as string, m(c.solde), c.maj_le as string]),
      );
  }
}

/** Fait télécharger un fichier par le navigateur. */
export function telecharger(contenu: string, nom: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
