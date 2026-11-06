import { describe, expect, it, vi } from "vitest";
import { verifierAcces, type EtatAcces } from "@/ia/acces";
import { lireReponseStructuree, ReponseIaInvalide } from "@/ia/appel";
import { categoriserAvecIa, construireConsigne, interpreterReponse, schemaDemande, schemaReponse, type CategoriePermise } from "@/ia/categoriser";

const CATS: CategoriePermise[] = [
  { id: "11111111-1111-4111-8111-111111111111", nom: "Épicerie", type: "depense" },
  { id: "22222222-2222-4222-8222-222222222222", nom: "Salaire et prestations", type: "revenu" },
];
const demande = schemaDemande.parse({
  transactions: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", date: "2026-10-05", libelle: "MARCHE ADONIS", montant: -4520 },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", date: "2026-10-06", libelle: "QUINCAILLERIE", montant: -1999 },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", date: "2026-10-07", libelle: "PAIE", montant: 145000 },
  ],
});

describe("accès à l'IA", () => {
  const base: EtatAcces = { disponible: true, connecte: true, iaActive: true, utilisationsDuJour: 0, limite: 30 };
  it("sans clé sur le serveur : indisponible (503), avant tout autre contrôle", () => {
    expect(verifierAcces({ ...base, disponible: false, connecte: false })).toEqual({ ok: false, refus: "indisponible", statut: 503 });
  });
  it("sans session : 401", () => {
    expect(verifierAcces({ ...base, connecte: false })).toEqual({ ok: false, refus: "session", statut: 401 });
  });
  it("réglage éteint (par défaut) : 403", () => {
    expect(verifierAcces({ ...base, iaActive: false })).toEqual({ ok: false, refus: "desactivee", statut: 403 });
  });
  it("limite quotidienne atteinte : 429", () => {
    expect(verifierAcces({ ...base, utilisationsDuJour: 30 })).toEqual({ ok: false, refus: "limite", statut: 429 });
    expect(verifierAcces({ ...base, utilisationsDuJour: 29 })).toEqual({ ok: true });
  });
});

describe("consigne envoyée au modèle", () => {
  it("contient seulement les catégories, la date, le libellé masqué et le montant", () => {
    const c = construireConsigne(CATS, {
      transactions: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", date: "2026-10-05", libelle: "VIREMENT 0012345678 MARCHE ADONIS", montant: -4520 }],
    });
    const m = JSON.parse(c.contenu);
    expect(m.categories).toHaveLength(2);
    expect(m.transactions[0]).toEqual({ i: 0, date: "2026-10-05", libelle: "VIREMENT [numéro masqué] MARCHE ADONIS", montant: "-45.20" });
    expect(c.contenu).not.toContain("aaaaaaaa");
    expect(c.contenu).not.toContain("0012345678");
    expect(c.systeme).toContain("inconnu");
  });
  it("refuse plus de 120 transactions par demande", () => {
    const t = Array.from({ length: 121 }, (_, i) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`, date: "2026-10-05", libelle: "X", montant: -1 }));
    expect(schemaDemande.safeParse({ transactions: t }).success).toBe(false);
  });
  it("refuse une transaction sans date", () => {
    expect(schemaDemande.safeParse({ transactions: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", libelle: "X", montant: -1 }] }).success).toBe(false);
  });
});

const conso = { modele: "claude-haiku-5-5", jetonsEntree: 812, jetonsSortie: 40 };

describe("réponse du modèle", () => {
  it("retient seulement les catégories permises, une fois par transaction", () => {
    const r = {
      resultats: [
        { i: 0, categorie: CATS[0]!.id },
        { i: 0, categorie: CATS[1]!.id },
        { i: 1, categorie: "inconnu" },
        { i: 2, categorie: "catégorie-inventée" },
        { i: 9, categorie: CATS[0]!.id },
        { i: -1, categorie: CATS[0]!.id },
      ],
    };
    expect(interpreterReponse(r, demande, CATS)).toEqual([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categorieId: CATS[0]!.id }]);
  });
  it.each(["pas du JSON", '{"resultat":[]}', '{"resultats":[{"i":"zéro","categorie":"x"}]}', 'Voici : {"resultats":[]}'])(
    "réponse invalide « %s » : rejetée en entier, consommation gardée pour le journal",
    (texte) => {
      try {
        lireReponseStructuree(texte, schemaReponse, conso);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ReponseIaInvalide);
        expect((e as ReponseIaInvalide).consommation).toEqual(conso);
      }
    },
  );
  it("avec un faux modèle : gamme rapide, schéma de réponse, résultats et jetons remontés", async () => {
    const appel = vi.fn().mockResolvedValue({ donnees: { resultats: [{ i: 0, categorie: CATS[0]!.id }] }, ...conso });
    const r = await categoriserAvecIa(appel, CATS, demande);
    expect(appel).toHaveBeenCalledOnce();
    expect(appel.mock.calls[0]![0]).toMatchObject({ gamme: "rapide", schema: schemaReponse });
    expect(r).toEqual({ resultats: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categorieId: CATS[0]!.id }], ...conso });
  });
});
