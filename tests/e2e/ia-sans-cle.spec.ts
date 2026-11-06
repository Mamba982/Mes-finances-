import { expect, test } from "@playwright/test";

/**
 * Sans ANTHROPIC_API_KEY (serveur de test) : l'IA est indisponible et chaque route /api/ia/*
 * répond 503 en français avant de lire la demande ou la session — aucune requête ne part.
 */
test.describe("IA sans clé", () => {
  test("état indisponible ; toutes les routes répondent 503 avant tout contrôle", async ({ request }) => {
    expect(await (await request.get("/api/ia/etat")).json()).toEqual({ disponible: false });
    for (const route of ["categoriser", "releve", "assistant", "recu", "estimation"]) {
      const r = await request.post(`/api/ia/${route}`, { data: { nimporte: "quoi" } });
      expect(r.status(), route).toBe(503);
      expect(await r.json(), route).toEqual({ erreur: "L'IA n'est pas disponible sur ce serveur." });
    }
  });
});
