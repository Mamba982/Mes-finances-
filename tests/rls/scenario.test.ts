import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commeUtilisateur, reinitialiserBase, urlBaseTest, type Executeur } from "./db";

const A = randomUUID();
const B = randomUUID();
let admin: pg.Client;
let commeA: Executeur;
let commeB: Executeur;
let projetA: string;
let projetB: string;

const appliquer = (ex: Executeur, projets: unknown[], capacite: string | null) =>
  ex("select appliquer_scenario($1::jsonb, $2::numeric)", [JSON.stringify(projets), capacite]);

beforeAll(async () => {
  admin = new pg.Client({ connectionString: urlBaseTest() });
  await admin.connect();
  await reinitialiserBase(admin);
  await admin.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  commeA = commeUtilisateur(admin, A);
  commeB = commeUtilisateur(admin, B);
  const ins = "insert into projets (nom, cout, echeance, priorite) values ('Ordinateur', 1600, '2027-05-04', 3) returning id";
  projetA = (await commeA<{ id: string }>(ins)).rows[0]!.id;
  projetB = (await commeB<{ id: string }>(ins)).rows[0]!.id;
});
afterAll(async () => admin?.end());

describe("appliquer un scénario", () => {
  it("met à jour échéance, coût et capacité manuelle", async () => {
    await appliquer(commeA, [{ id: projetA, echeance: "2027-11-04", cout: "1200.00" }], "700.00");
    const p = await commeA<{ e: string; c: string }>("select echeance::text as e, cout::text as c from projets");
    expect(p.rows).toEqual([{ e: "2027-11-04", c: "1200.00" }]);
    const pr = await commeA<{ m: string; c: string }>("select mode_capacite::text as m, capacite_manuelle::text as c from profils");
    expect(pr.rows).toEqual([{ m: "manuel", c: "700.00" }]);
  });

  it("sans changement d'épargne, la capacité reste telle quelle", async () => {
    await appliquer(commeB, [{ id: projetB, echeance: "2027-06-01", cout: "1600.00" }], null);
    const pr = await commeB<{ m: string }>("select mode_capacite::text as m from profils");
    expect(pr.rows[0]!.m).toBe("auto");
  });

  it("un projet d'un autre utilisateur fait tout échouer : rien n'est appliqué", async () => {
    await expect(
      appliquer(commeB, [{ id: projetB, echeance: "2030-01-01", cout: "9999.00" }, { id: projetA, echeance: "2030-01-01", cout: "1.00" }], "5.00"),
    ).rejects.toThrow(/Projet introuvable/);
    const b = await commeB<{ e: string; c: string }>("select echeance::text as e, cout::text as c from projets");
    expect(b.rows).toEqual([{ e: "2027-06-01", c: "1600.00" }]);
    const a = await commeA<{ c: string }>("select cout::text as c from projets");
    expect(a.rows[0]!.c).toBe("1200.00");
  });

  it("un coût invalide (≤ 0) est refusé par la base", async () => {
    await expect(appliquer(commeA, [{ id: projetA, echeance: "2027-11-04", cout: "0" }], null)).rejects.toThrow(/check/);
  });
});
