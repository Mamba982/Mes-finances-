import "server-only";

import { z } from "zod";

/**
 * Configuration de l'IA, lue côté serveur seulement. Sans ANTHROPIC_API_KEY, l'IA est indisponible :
 * aucune route n'appelle Anthropic et l'application fonctionne entièrement sans elle.
 */
const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(20).optional(),
  ANTHROPIC_MODEL: z.string().min(3).optional(),
  ANTHROPIC_MODEL_RAPIDE: z.string().min(3).optional(),
  IA_LIMITE_QUOTIDIENNE: z.coerce.number().int().min(1).max(1000).default(30),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
});

export function configIa() {
  const e = schema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
    ANTHROPIC_MODEL_RAPIDE: process.env.ANTHROPIC_MODEL_RAPIDE || undefined,
    IA_LIMITE_QUOTIDIENNE: process.env.IA_LIMITE_QUOTIDIENNE || undefined,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
  });
  const modeleRapide = e.ANTHROPIC_MODEL_RAPIDE ?? e.ANTHROPIC_MODEL;
  const modeleComplet = e.ANTHROPIC_MODEL ?? e.ANTHROPIC_MODEL_RAPIDE;
  return {
    // Le journal des jetons (usage_ia) s'écrit avec la clé secrète : sans elle, pas d'IA non plus.
    disponible: Boolean(e.ANTHROPIC_API_KEY && modeleRapide && modeleComplet && e.SUPABASE_SECRET_KEY),
    cle: e.ANTHROPIC_API_KEY,
    modeleRapide,
    modeleComplet,
    limite: e.IA_LIMITE_QUOTIDIENNE,
    cleSupabase: e.SUPABASE_SECRET_KEY,
  };
}
