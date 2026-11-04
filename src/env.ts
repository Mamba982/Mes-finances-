import { z } from "zod";

/**
 * Variables publiques (exposées au navigateur). Les secrets sont lus dans src/env-serveur.ts.
 * Next remplace process.env.NEXT_PUBLIC_* au moment du build : il faut les nommer une par une.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export const envPublic = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
