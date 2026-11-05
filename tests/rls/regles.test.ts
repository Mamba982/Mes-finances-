import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commeUtilisateur, reinitialiserBase, urlBaseTest, type Executeur } from "./db";

const A = randomUUID();
const B = randomUUID();
let admin: pg.Client;
let commeA: Executeur;
let commeB: Executeur;
let epicerieA: string;
let epicerieB: string;
let txA: string;

beforeAll(async () => {
  admin = new pg.Client({ connectionString: urlBaseTest() });
  await admin.connect();
  await reinitialiserBase(admin);
  await admin.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  commeA = commeUtilisateur(admin, A);
  commeB = commeUtilisateur(admin, B);
  epicerieA = (await commeA<{ id: string }>("select id from categories where code = 'epicerie'")).rows[0]!.id;
  epicerieB = (await commeB<{ id: string }>("select id from categories where code = 'epicerie'")).rows[0]!.id;
  txA = (
    await commeA<{ id: string }>(
      "insert into transactions (date, libelle_brut, marchand, montant, source) values ('2026-10-05','MAXI','Maxi',-10,'manuel') returning id",
    )
  ).rows[0]!.id;
});
afterAll(async () => admin?.end());

describe("règles de classement", () => {
  it("chaque utilisateur ne voit que ses règles", async () => {
    await commeA("insert into regles_categorie (motif, categorie_id, origine) values ('maxi', $1, 'auto')", [epicerieA]);
    expect((await commeB<{ n: string }>("select count(*) as n from regles_categorie")).rows[0]!.n).toBe("0");
    expect((await commeA<{ n: string }>("select count(*) as n from regles_categorie")).rows[0]!.n).toBe("1");
  });

  it("une règle ne peut pas viser la catégorie d'un autre utilisateur", async () => {
    await expect(commeB("insert into regles_categorie (motif, categorie_id) values ('iga', $1)", [epicerieA])).rejects.toThrow(/foreign key/);
  });

  it("un motif doit être normalisé et unique par utilisateur", async () => {
    await expect(commeA("insert into regles_categorie (motif, categorie_id) values ('Maxi!', $1)", [epicerieA])).rejects.toThrow(/check/);
    await expect(commeA("insert into regles_categorie (motif, categorie_id) values ('maxi', $1)", [epicerieA])).rejects.toThrow(/unique/);
    const ok = await commeB("insert into regles_categorie (motif, categorie_id) values ('maxi', $1)", [epicerieB]);
    expect(ok.rowCount).toBe(1);
  });

  it("supprimer une catégorie supprime ses règles", async () => {
    const c = (await commeA<{ id: string }>("insert into categories (nom, type) values ('Garderie', 'depense') returning id")).rows[0]!.id;
    await commeA("insert into regles_categorie (motif, categorie_id) values ('garderie', $1)", [c]);
    await commeA("delete from categories where id = $1", [c]);
    expect((await commeA<{ n: string }>("select count(*) as n from regles_categorie where motif = 'garderie'")).rows[0]!.n).toBe("0");
  });
});

describe("classer en lot", () => {
  it("B ne peut pas classer une transaction de A", async () => {
    const n = await commeB<{ n: number }>("select classer_transactions($1::jsonb) as n", [JSON.stringify([{ id: txA, categorie_id: epicerieB }])]);
    expect(n.rows[0]!.n).toBe(0);
    const t = await commeA<{ c: string | null }>("select categorie_id as c from transactions where id = $1", [txA]);
    expect(t.rows[0]!.c).toBeNull();
  });

  it("A classe ses transactions ; une catégorie étrangère fait tout échouer", async () => {
    await expect(
      commeA("select classer_transactions($1::jsonb)", [JSON.stringify([{ id: txA, categorie_id: epicerieB }])]),
    ).rejects.toThrow(/foreign key/);
    const n = await commeA<{ n: number }>("select classer_transactions($1::jsonb) as n", [JSON.stringify([{ id: txA, categorie_id: epicerieA }])]);
    expect(n.rows[0]!.n).toBe(1);
  });

  it("le réglage de l'IA est éteint par défaut", async () => {
    expect((await commeA<{ ia: boolean }>("select ia_active as ia from profils")).rows[0]!.ia).toBe(false);
  });
});
