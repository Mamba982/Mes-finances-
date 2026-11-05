import { describe, expect, it, vi } from "vitest";
import { verifierAcces, type EtatAcces } from "@/ia/acces";
import { categoriserAvecIa, construireConsigne, interpreterReponse, ReponseIaInvalide, schemaDemande, type CategoriePermise } from "@/ia/categoriser";

const CATS: CategoriePermise[] = [
  { id: "11111111-1111-4111-8111-111111111111", nom: "Épicerie", type: "depense" },
  { id: "22222222-2222-4222-8222-222222222222", nom: "Salaire et prestations", type: "revenu" },
];
const demande = schemaDemande.parse({
  transactions: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", libelle: "MARCHE ADONIS", montant: -4520 },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", libelle: "QUINCAILLERIE", montant: -1999 },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", libelle: "PAIE", montant: 145000 },
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
  it("contient seulement les catégories, libellés et montants nécessaires", () => {
    const c = construireConsigne(CATS, demande);
    const m = JSON.parse(c.message);
    expect(m.categories).toHaveLength(2);
    expect(m.transactions[0]).toEqual({ i: 0, libelle: "MARCHE ADONIS", montant: -4520 });
    expect(c.message).not.toContain("aaaaaaaa");
    expect(c.systeme).toContain("inconnu");
  });
  it("refuse plus de 120 transactions par demande", () => {
    const t = Array.from({ length: 121 }, (_, i) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`, libelle: "X", montant: -1 }));
    expect(schemaDemande.safeParse({ transactions: t }).success).toBe(false);
  });
});

describe("réponse du modèle", () => {
  it("retient seulement les catégories permises, une fois par transaction", () => {
    const texte = JSON.stringify({
      resultats: [
        { i: 0, categorie: CATS[0]!.id },
        { i: 0, categorie: CATS[1]!.id },
        { i: 1, categorie: "inconnu" },
        { i: 2, categorie: "catégorie-inventée" },
        { i: 9, categorie: CATS[0]!.id },
      ],
    });
    expect(interpreterReponse(texte, demande, CATS)).toEqual([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categorieId: CATS[0]!.id }]);
  });
  it("accepte du texte autour de l'objet JSON", () => {
    expect(interpreterReponse(`Voici : {"resultats":[{"i":2,"categorie":"${CATS[1]!.id}"}]}`, demande, CATS)).toHaveLength(1);
  });
  it.each(["pas du JSON", '{"resultat":[]}', '{"resultats":[{"i":"zéro","categorie":"x"}]}', '{"resultats":[{"i":-1,"categorie":"x"}]}'])(
    "réponse invalide « %s » : rejetée en entier",
    (texte) => {
      expect(() => interpreterReponse(texte, demande, CATS)).toThrow(ReponseIaInvalide);
    },
  );
  it("avec un faux modèle : résultats et jetons remontés pour le journal", async () => {
    const appel = vi.fn().mockResolvedValue({ texte: `{"resultats":[{"i":0,"categorie":"${CATS[0]!.id}"}]}`, jetonsEntree: 812, jetonsSortie: 40 });
    const r = await categoriserAvecIa(appel, CATS, demande);
    expect(appel).toHaveBeenCalledOnce();
    expect(r).toEqual({ resultats: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categorieId: CATS[0]!.id }], jetonsEntree: 812, jetonsSortie: 40 });
  });
});
