import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commeUtilisateur, reinitialiserBase, urlBaseTest, type Executeur } from "./db";

const A = randomUUID();
const B = randomUUID();
let admin: pg.Client;
let commeA: Executeur;
let commeB: Executeur;
let commeAnon: Executeur;
const ids: Record<string, string> = {};

const TABLES = [
  "profils", "categories", "imports", "projets", "postes_projet",
  "versements", "factures", "transactions", "comptes",
] as const;

function empreinte(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

beforeAll(async () => {
  admin = new pg.Client({ connectionString: urlBaseTest() });
  await admin.connect();
  await reinitialiserBase(admin);
  await admin.query("insert into auth.users (id, email) values ($1, 'a@exemple.ca'), ($2, 'b@exemple.ca')", [A, B]);
  commeA = commeUtilisateur(admin, A);
  commeB = commeUtilisateur(admin, B);
  commeAnon = commeUtilisateur(admin, null);

  // A crée une ligne dans chaque table.
  const one = async (sql: string, p: unknown[] = []) => (await commeA<{ id: string }>(sql, p)).rows[0]!.id;
  ids.import = await one(
    "insert into imports (nom_fichier, format, lignes_lues, lignes_importees, lignes_ecartees) values ('rbc.csv','csv',2,2,0) returning id",
  );
  ids.projet = await one(
    "insert into projets (nom, cout, echeance, priorite) values ('Fonds d''urgence', 5000, '2027-09-01', 1) returning id",
  );
  ids.poste = await one("insert into postes_projet (projet_id, nom, montant) values ($1, 'Loyer', 1050) returning id", [ids.projet]);
  ids.versement = await one("insert into versements (projet_id, montant, date) values ($1, 300, '2026-10-03') returning id", [ids.projet]);
  ids.facture = await one(
    `insert into factures (numero, client, description, montant_ht, taux_tps, taux_tvq, tps, tvq)
     values ('F-2026-001', 'Restaurant Le Baobab', 'Traiteur', 750, 5, 9.975, 37.5, 74.81) returning id`,
  );
  ids.transaction = await one(
    `insert into transactions (date, libelle_brut, marchand, montant, source, empreinte, import_id)
     values ('2026-10-05', 'MAXI #8812 QUEBEC', 'Maxi', -84.22, 'import', $1, $2) returning id`,
    [empreinte("a1"), ids.import],
  );
  ids.compte = await one("insert into comptes (nom, type, solde) values ('CELI', 'celi', 2400) returning id");
  ids.categorie = (await commeA<{ id: string }>("select id from categories where code = 'epicerie'")).rows[0]!.id;
});

afterAll(async () => {
  await admin?.end();
});

describe("inscription", () => {
  it("crée un profil et les 18 catégories par défaut du prototype", async () => {
    const p = await commeB("select devise, taux_tps::text, taux_tvq::text, frais_carte_pct::text, frais_carte_fixe::text from profils");
    expect(p.rows).toEqual([{ devise: "CAD", taux_tps: "5.0000", taux_tvq: "9.9750", frais_carte_pct: "2.9000", frais_carte_fixe: "0.25" }]);
    const c = await commeB<{ n: string }>("select count(*) as n from categories");
    expect(Number(c.rows[0]!.n)).toBe(18);
  });
});

describe("isolation entre deux utilisateurs", () => {
  it.each(TABLES)("B ne lit aucune ligne de A dans « %s »", async (table) => {
    const r = await commeB<{ n: string }>(`select count(*) as n from ${table} where user_id = $1`, [A]);
    expect(Number(r.rows[0]!.n)).toBe(0);
  });

  it.each(TABLES)("A voit ses propres lignes dans « %s »", async (table) => {
    const r = await commeA<{ n: string }>(`select count(*) as n from ${table}`);
    expect(Number(r.rows[0]!.n)).toBeGreaterThan(0);
  });

  it.each(TABLES)("B ne modifie aucune ligne de A dans « %s »", async (table) => {
    const r = await commeB(`update ${table} set user_id = user_id where user_id = $1`, [A]);
    expect(r.rowCount).toBe(0);
  });

  it.each(TABLES.filter((t) => t !== "profils"))("B ne supprime aucune ligne de A dans « %s »", async (table) => {
    const r = await commeB(`delete from ${table} where user_id = $1`, [A]);
    expect(r.rowCount).toBe(0);
    const reste = await commeA<{ n: string }>(`select count(*) as n from ${table}`);
    expect(Number(reste.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("B ne peut pas insérer une ligne au nom de A", async () => {
    await expect(
      commeB("insert into comptes (user_id, nom, type, solde) values ($1, 'Piège', 'autre', 1)", [A]),
    ).rejects.toThrow(/row-level security/);
  });

  it("B ne peut pas transférer sa propre ligne à A", async () => {
    await commeB("insert into comptes (nom, type, solde) values ('Mien', 'autre', 1)");
    await expect(commeB("update comptes set user_id = $1", [A])).rejects.toThrow(/row-level security/);
  });

  it("B ne peut pas rattacher un versement au projet de A, même avec son identifiant", async () => {
    await expect(
      commeB("insert into versements (projet_id, montant, date) values ($1, 100, '2026-11-01')", [ids.projet]),
    ).rejects.toThrow(/foreign key/);
  });

  it("B ne peut pas classer sa transaction dans une catégorie de A", async () => {
    await expect(
      commeB(
        "insert into transactions (date, libelle_brut, marchand, montant, source, categorie_id) values ('2026-11-01','X','X',-1,'manuel',$1)",
        [ids.categorie],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("un visiteur non connecté n'a accès à aucune table", async () => {
    for (const table of TABLES) {
      await expect(commeAnon(`select * from ${table}`)).rejects.toThrow(/permission denied/);
    }
  });
});

describe("journal IA", () => {
  it("l'utilisateur ne peut ni écrire ni effacer son compteur", async () => {
    await expect(
      commeA("insert into usage_ia (user_id, route, modele, succes) values ($1, 'x', 'x', true)", [A]),
    ).rejects.toThrow(/permission denied/);
    await expect(commeA("delete from usage_ia")).rejects.toThrow(/permission denied/);
  });

  it("l'utilisateur lit seulement ses propres lignes", async () => {
    await admin.query(
      "insert into usage_ia (user_id, route, modele, jetons_entree, jetons_sortie, succes) values ($1,'assistant','m',10,5,true),($2,'assistant','m',10,5,true)",
      [A, B],
    );
    const r = await commeB<{ user_id: string }>("select user_id from usage_ia");
    expect(r.rows.map((x) => x.user_id)).toEqual([B]);
  });
});

describe("doublons", () => {
  it("la même empreinte ne peut entrer qu'une fois pour un utilisateur", async () => {
    const sql = `insert into transactions (date, libelle_brut, marchand, montant, source, empreinte)
                 values ('2026-10-05','MAXI #8812 QUEBEC','Maxi',-84.22,'import',$1) on conflict do nothing`;
    const r = await commeA(sql, [empreinte("a1")]);
    expect(r.rowCount).toBe(0);
  });

  it("deux utilisateurs peuvent avoir la même empreinte", async () => {
    const r = await commeB(
      `insert into transactions (date, libelle_brut, marchand, montant, source, empreinte)
       values ('2026-10-05','MAXI #8812 QUEBEC','Maxi',-84.22,'import',$1)`,
      [empreinte("a1")],
    );
    expect(r.rowCount).toBe(1);
  });
});

describe("facture payée", () => {
  it("B ne peut pas marquer la facture de A comme payée", async () => {
    await commeB("select marquer_facture_payee($1, '2026-11-01')", [ids.facture]);
    const f = await commeA<{ statut: string }>("select statut from factures where id = $1", [ids.facture]);
    expect(f.rows[0]!.statut).toBe("brouillon");
  });

  it("marquer payée deux fois crée exactement une transaction de revenu", async () => {
    await commeA("select marquer_facture_payee($1, '2026-11-01')", [ids.facture]);
    await commeA("select marquer_facture_payee($1, '2026-11-02')", [ids.facture]);
    const t = await commeA<{ montant: string; source: string; date: Date; code: string }>(
      `select t.montant::text as montant, t.source, c.code from transactions t
       left join categories c on c.id = t.categorie_id where t.facture_id = $1`,
      [ids.facture],
    );
    expect(t.rows).toEqual([{ montant: "862.31", source: "facture", code: "rev-entreprise" }]);
    const f = await commeA<{ statut: string; d: string }>(
      "select statut, date_paiement::text as d from factures where id = $1",
      [ids.facture],
    );
    expect(f.rows[0]).toEqual({ statut: "payee", d: "2026-11-01" });
  });
});

describe("photos de reçus", () => {
  it("B ne lit ni n'ajoute de fichier dans le dossier de A", async () => {
    await admin.query("insert into storage.objects (bucket_id, name) values ('recus', $1)", [`${A}/recu.jpg`]);
    const lu = await commeB<{ n: string }>("select count(*) as n from storage.objects");
    expect(Number(lu.rows[0]!.n)).toBe(0);
    await expect(
      commeB("insert into storage.objects (bucket_id, name) values ('recus', $1)", [`${A}/piege.jpg`]),
    ).rejects.toThrow(/row-level security/);
    const ok = await commeB("insert into storage.objects (bucket_id, name) values ('recus', $1)", [`${B}/mien.jpg`]);
    expect(ok.rowCount).toBe(1);
  });
});

describe("suppression du compte", () => {
  it("supprimer l'utilisateur efface toutes ses lignes", async () => {
    await admin.query("delete from auth.users where id = $1", [A]);
    for (const table of [...TABLES, "usage_ia"]) {
      const r = await admin.query<{ n: string }>(`select count(*) as n from ${table} where user_id = $1`, [A]);
      expect(Number(r.rows[0]!.n), table).toBe(0);
    }
  });
});
