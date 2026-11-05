import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { AppelModele } from "./categoriser";

/** Appel réel au modèle Claude (créé seulement quand une clé est configurée). */
export function appelClaude(cle: string, modele: string): AppelModele {
  const client = new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 60_000 });
  return async ({ systeme, message }) => {
    const r = await client.messages.create({
      model: modele,
      max_tokens: 4000,
      system: systeme,
      messages: [{ role: "user", content: message }],
    });
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") throw new Error(r.stop_reason);
    const texte = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { texte, jetonsEntree: r.usage.input_tokens, jetonsSortie: r.usage.output_tokens };
  };
}
