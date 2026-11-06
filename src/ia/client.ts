import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type AppelModele, lireReponseStructuree, RefusModele, ReponseIaInvalide } from "./appel";

/**
 * Appel réel à Claude (créé seulement quand une clé est configurée).
 * - Réponse contrainte par le schéma (sorties structurées), puis revalidée par Zod.
 * - « rapide » (Haiku 5.5) : sans réflexion, effort bas — un classement n'en demande pas.
 * - « complet » (Sonnet 5.5) : réflexion adaptative à effort bas (extraction, questions courtes).
 * - En flux : les longues extractions ne butent pas sur le délai d'une requête simple.
 */
export function appelClaude(cle: string, modeles: { rapide: string; complet: string }): AppelModele {
  const client = new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 120_000 });
  return async ({ systeme, contenu, schema, gamme, maxJetons }) => {
    const modele = gamme === "rapide" ? modeles.rapide : modeles.complet;
    const message = await client.messages
      .stream({
        model: modele,
        max_tokens: maxJetons ?? 8000,
        system: systeme,
        messages: [{ role: "user", content: contenu }],
        ...(gamme === "rapide" ? { thinking: { type: "disabled" as const } } : {}),
        output_config: { effort: "low", format: zodOutputFormat(schema) },
      })
      .finalMessage();

    const consommation = { modele, jetonsEntree: message.usage.input_tokens, jetonsSortie: message.usage.output_tokens };
    if (message.stop_reason === "refusal") throw new RefusModele("refus", consommation);
    if (message.stop_reason === "max_tokens") throw new ReponseIaInvalide("réponse coupée", consommation);
    const texte = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { donnees: lireReponseStructuree(texte, schema, consommation), ...consommation };
  };
}
