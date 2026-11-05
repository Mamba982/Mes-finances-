import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { centsVersDecimal } from "@/domaine/argent";
import { normaliserMarchand } from "@/domaine/categorisation";
import { empreintes } from "@/domaine/doublons";
import { transactionsReleves } from "../unitaires/aides";
import { commeUtilisateur, reinitialiserBase, urlBaseTest, type Executeur } from "./db";

const A = randomUUID();
const B = randomUUID();
let admin: pg.Client;
let commeA: Executeur;
let commeB: Executeur;

async function lignesReleve() {
  const t = transactionsReleves();
  const e = await empreintes(t);
  return t.map((x, i) => ({
    date: x.date,
    libelle: x.libelle,
    marchand: normaliserMarchand(x.libelle),
    montant: centsVersDecimal(x.montant),
    categorie_id: "",
    empreinte: e[i],
  }));
}

const importer = (ex: Executeur, lignes: unknown[], lues = lignes.length) =>
  ex<{ r: { importees: number; ecartees: number } }>("select importer_releve('releve.csv', 'csv', $1, $2::jsonb) as r", [
    lues,
    JSON.stringify(lignes),
  ]).then((res) => res.rows[0]!.r);

beforeAll(async () => {
  admin = new pg.Client({ connectionString: urlBaseTest() });
  await admin.connect();
  await reinitialiserBase(admin);
  await admin.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  commeA = commeUtilisateur(admin, A);
  commeB = commeUtilisateur(admin, B);
});
afterAll(async () => admin?.end());

describe("import d'un relevé", () => {
  it("le premier import enregistre les 55 lignes, dont les deux cafés identiques", async () => {
    expect(await importer(commeA, await lignesReleve())).toEqual(expect.objectContaining({ importees: 55, ecartees: 0 }));
    const n = await commeA<{ n: string }>("select count(*) as n from transactions where libelle_brut = 'TIM HORTONS #2231' and date = '2026-10-15'");
    expect(Number(n.rows[0]!.n)).toBe(2);
  });

  it("importer deux fois le même fichier ne crée aucune transaction en double", async () => {
    expect(await importer(commeA, await lignesReleve())).toEqual(expect.objectContaining({ importees: 0, ecartees: 55 }));
    const n = await commeA<{ n: string }>("select count(*) as n from transactions");
    expect(Number(n.rows[0]!.n)).toBe(55);
    const imp = await commeA<{ lignes_lues: number; lignes_importees: number; lignes_ecartees: number }>(
      "select lignes_lues, lignes_importees, lignes_ecartees from imports order by cree_le",
    );
    expect(imp.rows).toEqual([
      { lignes_lues: 55, lignes_importees: 55, lignes_ecartees: 0 },
      { lignes_lues: 55, lignes_importees: 0, lignes_ecartees: 55 },
    ]);
  });

  it("les lignes décochées comptent comme écartées", async () => {
    const r = await importer(commeB, (await lignesReleve()).slice(0, 50), 55);
    expect(r).toEqual(expect.objectContaining({ importees: 50, ecartees: 5 }));
  });

  it("une ligne invalide annule tout l'import : aucune trace, aucune transaction", async () => {
    const l = await lignesReleve();
    const avant = await commeB<{ n: string }>("select count(*) as n from transactions");
    l[3] = { ...l[3]!, date: "2026-02-30", empreinte: "f".repeat(64) };
    const nouvelles = l.map((x, i) => ({ ...x, empreinte: i.toString(16).padStart(64, "a") }));
    await expect(importer(commeB, nouvelles)).rejects.toThrow();
    const apres = await commeB<{ n: string }>("select count(*) as n from transactions");
    expect(apres.rows[0]!.n).toBe(avant.rows[0]!.n);
    const imp = await commeB<{ n: string }>("select count(*) as n from imports");
    expect(Number(imp.rows[0]!.n)).toBe(1);
  });

  it("une catégorie d'un autre utilisateur est refusée", async () => {
    const catA = (await commeA<{ id: string }>("select id from categories where code = 'epicerie'")).rows[0]!.id;
    const l = (await lignesReleve()).slice(0, 1).map((x) => ({ ...x, categorie_id: catA, empreinte: "b".repeat(64) }));
    await expect(importer(commeB, l)).rejects.toThrow(/foreign key/);
  });

  it("un visiteur non connecté ne peut pas importer", async () => {
    await expect(importer(commeUtilisateur(admin, null), [])).rejects.toThrow(/permission denied/);
  });
});
