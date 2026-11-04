import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const RACINE = join(import.meta.dirname, "..", "..");

export function urlBaseTest(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST manquant. Lance d'abord : bash scripts/db-test.sh (voir CLAUDE.md).",
    );
  }
  return url;
}

/** Recrée une base vierge : schémas Supabase simulés, puis toutes les migrations dans l'ordre. */
export async function reinitialiserBase(admin: pg.Client): Promise<void> {
  await admin.query(`
    drop schema if exists public cascade;
    drop schema if exists auth cascade;
    drop schema if exists storage cascade;
    create schema public;
  `);
  await admin.query(readFileSync(join(RACINE, "tests/rls/stub-supabase.sql"), "utf8"));
  const dossier = join(RACINE, "supabase/migrations");
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort()) {
    await admin.query(readFileSync(join(dossier, fichier), "utf8"));
  }
}

export type Executeur = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<pg.QueryResult<T>>;

/**
 * Exécute une requête avec le rôle et l'identité qu'aurait une requête PostgREST de Supabase.
 * userId = null : visiteur anonyme (rôle anon).
 */
export function commeUtilisateur(admin: pg.Client, userId: string | null): Executeur {
  return async (sql, params = []) => {
    await admin.query("begin");
    try {
      await admin.query(`set local role ${userId ? "authenticated" : "anon"}`);
      await admin.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
      ]);
      const res = await admin.query(sql, params);
      await admin.query("commit");
      return res;
    } catch (e) {
      await admin.query("rollback");
      throw e;
    }
  };
}
