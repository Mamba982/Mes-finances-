import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commeUtilisateur, reinitialiserBase, urlBaseTest, type Executeur } from "./db";

const A = randomUUID();
let admin: pg.Client;
let commeA: Executeur;

const creer = (numero: string, ht: string, taxable = true) =>
  commeA<{ id: string; tps: string; tvq: string }>(
    `insert into factures (numero, client, description, montant_ht, taxable, taux_tps, taux_tvq, tps, tvq)
     values ($1, 'Client', 'Service', $2, $3, 5, 9.975, 999, 999) returning id, tps::text, tvq::text`,
    [numero, ht, taxable],
  ).then((r) => r.rows[0]!);

beforeAll(async () => {
  admin = new pg.Client({ connectionString: urlBaseTest() });
  await admin.connect();
  await reinitialiserBase(admin);
  await admin.query("insert into auth.users (id) values ($1)", [A]);
  commeA = commeUtilisateur(admin, A);
});
afterAll(async () => admin?.end());

describe("factures", () => {
  it("la base calcule TPS et TVQ, sans tenir compte des valeurs envoyées", async () => {
    expect(await creer("F-2026-001", "750")).toEqual(expect.objectContaining({ tps: "37.50", tvq: "74.81" }));
    expect(await creer("F-2026-002", "750", false)).toEqual(expect.objectContaining({ tps: "0.00", tvq: "0.00" }));
  });

  it("le numéro est unique par utilisateur et suit le format F-AAAA-NNN", async () => {
    await expect(creer("F-2026-001", "10")).rejects.toThrow(/unique/);
    await expect(creer("2026-003", "10")).rejects.toThrow(/check/);
  });

  it("on ne peut pas passer une facture à « payée » sans créer son revenu", async () => {
    const f = await creer("F-2026-003", "100");
    await expect(commeA("update factures set statut = 'payee', date_paiement = '2026-11-01' where id = $1", [f.id])).rejects.toThrow(
      /marquer_facture_payee/,
    );
    await expect(
      commeA(
        `insert into factures (numero, client, description, montant_ht, taux_tps, taux_tvq, statut, date_paiement)
         values ('F-2026-099', 'C', 'S', 10, 5, 9.975, 'payee', '2026-11-01')`,
      ),
    ).rejects.toThrow(/marquer_facture_payee/);
  });

  it("payée deux fois : une seule transaction de revenu, puis la facture est verrouillée", async () => {
    const f = await creer("F-2026-004", "750");
    const t1 = (await commeA<{ t: string }>("select marquer_facture_payee($1, '2026-11-01') as t", [f.id])).rows[0]!.t;
    const t2 = (await commeA<{ t: string }>("select marquer_facture_payee($1, '2026-11-02') as t", [f.id])).rows[0]!.t;
    expect(t2).toBe(t1);
    const n = await commeA<{ n: string; m: string }>("select count(*) as n, max(montant)::text as m from transactions where facture_id = $1", [f.id]);
    expect(n.rows[0]).toEqual({ n: "1", m: "862.31" });
    await expect(commeA("update factures set montant_ht = 1 where id = $1", [f.id])).rejects.toThrow(/ne peut plus être modifiée/);
    await expect(commeA("update factures set statut = 'envoyee', date_paiement = null where id = $1", [f.id])).rejects.toThrow(
      /ne peut plus être modifiée/,
    );
  });

  it("une facture non payée reste modifiable, et ses taxes suivent le montant", async () => {
    const f = await creer("F-2026-005", "100");
    const r = await commeA<{ tps: string }>("update factures set montant_ht = 200, statut = 'envoyee' where id = $1 returning tps::text", [f.id]);
    expect(r.rows[0]!.tps).toBe("10.00");
  });
});
