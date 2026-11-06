import { describe, expect, it, vi } from "vitest";
import { resumeFinancier } from "@/domaine/assistant";
import { indexer, type Categorie, type Transaction } from "@/domaine/budget";
import { repartir } from "@/domaine/projets";
import { construireConsigneAssistant, repondreAvecIa, schemaDemandeAssistant, schemaReponseAssistant } from "@/ia/assistant";

const STATUTS = { ok: "Dans les temps", retard: "Sous-financé", nonfinance: "Non financé", atteint: "Objectif atteint", depasse: "Échéance dépassée" };
const cats: Categorie[] = [
  { id: "c-epi", code: "epicerie", nom: "Épicerie", type: "depense", budget: 0 },
  { id: "c-sal", code: "salaire", nom: "Salaire et prestations", type: "revenu", budget: 0 },
];
const tx = (id: string, date: string, montant: number, categorieId: string | null, libelle = "MAXI 0012345678"): Transaction => ({
  id, date, libelle, marchand: libelle, montant, categorieId, deductible: false, tps: 0, tvq: 0,
});
const transactions = [tx("1", "2026-10-05", -8422, "c-epi"), tx("2", "2026-10-15", 214500, "c-sal", "PAIE"), tx("3", "2026-11-02", -1250, null)];
const projets = [{ id: "p1", nom: "Fonds d'urgence", cout: 500000, montantDepart: 120000, echeance: "2027-09-04", priorite: 1 as const, notes: null, postes: [], versements: [] }];

/** Les montants formatés contiennent des espaces insécables ; on compare avec des espaces ordinaires. */
const espaces = <T>(x: T): T => JSON.parse(JSON.stringify(x).replace(/[\u00a0\u202f]/g, " "));

function resume() {
  return resumeFinancier({
    aujourdhui: "2026-11-04",
    capacite: { valeur: 50000, source: "manuel" },
    repartition: repartir(projets, 50000, "2026-11-04"),
    transactions,
    index: indexer(cats),
    comptes: [{ id: "a", nom: "CELI", type: "celi", solde: 240000, majLe: "2026-11-01" }],
    libellesStatut: STATUTS,
  });
}

describe("résumé transmis à l'assistant", () => {
  it("chiffres calculés par le domaine et formatés ; aucun libellé de transaction", () => {
    const r = espaces(resume());
    expect(r.capacite).toEqual({ parMois: "500,00 $", source: "entrée à la main" });
    expect(r.mois.map((m) => m.mois)).toEqual(["2026-10", "2026-11"]);
    expect(r.mois[0]).toMatchObject({ revenus: "2 145,00 $", depenses: "84,22 $" });
    expect(r.mois[0]!.principalesDepenses).toEqual([{ categorie: "Épicerie", montant: "84,22 $" }]);
    expect(r.mois[1]!.principalesDepenses).toEqual([{ categorie: "Sans catégorie", montant: "12,50 $" }]);
    expect(r.projets[0]).toMatchObject({ nom: "Fonds d'urgence", reste: "3 800,00 $", statut: "Dans les temps" });
    expect(r.avoir).toMatchObject({ net: "2 400,00 $" });
    const json = JSON.stringify(r);
    expect(json).not.toContain("MAXI");
    expect(json).not.toContain("0012345678");
  });
  it("le résumé produit passe le schéma du serveur", () => {
    expect(schemaDemandeAssistant.safeParse({ question: "Est-ce que je peux tenir mes échéances ?", resume: resume() }).success).toBe(true);
  });
  it("question trop courte ou trop longue refusée", () => {
    expect(schemaDemandeAssistant.safeParse({ question: "  a ", resume: resume() }).success).toBe(false);
    expect(schemaDemandeAssistant.safeParse({ question: "x".repeat(501), resume: resume() }).success).toBe(false);
  });
});

describe("consigne de l'assistant", () => {
  it("interdit tout calcul, masque les numéros de la question", () => {
    const c = construireConsigneAssistant({ question: "Combien sur le compte 0012345678 ?", resume: resume() });
    expect(c.systeme).toContain("Ne fais aucun calcul");
    expect(c.contenu).not.toContain("0012345678");
    expect(c.contenu).toContain("Fonds d'urgence");
  });
  it("avec un faux modèle : gamme complète, schéma de réponse", async () => {
    const appel = vi.fn().mockResolvedValue({ donnees: { reponse: "Oui." }, modele: "claude-sonnet-5-5", jetonsEntree: 1500, jetonsSortie: 200 });
    const r = await repondreAvecIa(appel, { question: "Est-ce que ça va ?", resume: resume() });
    expect(appel.mock.calls[0]![0]).toMatchObject({ gamme: "complet", schema: schemaReponseAssistant });
    expect(r).toEqual({ reponse: "Oui.", modele: "claude-sonnet-5-5", jetonsEntree: 1500, jetonsSortie: 200 });
  });
});
