import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Essais contre la VRAIE API d'Anthropic, à travers l'application déployée (la clé n'existe que là).
 * Chaque passage coûte quelques sous : jamais dans `npm run test:e2e`, seulement `npm run test:ia`.
 * Demande IA_URL (ex. https://mes-finances-phi.vercel.app) et SUPABASE_SECRET_KEY.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  /* variables déjà dans l'environnement */
}
const chromium = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(chromium) ? chromium : undefined;
// Dans un conteneur à mandataire HTTPS, les requêtes de Playwright (hors navigateur) doivent le traverser aussi.
const mandataire = process.env.HTTPS_PROXY ?? process.env.https_proxy;

export default defineConfig({
  testDir: "tests/ia-reel",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.IA_URL,
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    trace: "off",
    ...(mandataire ? { proxy: { server: mandataire, bypass: process.env.NO_PROXY ?? process.env.no_proxy } } : {}),
    launchOptions: { executablePath },
  },
  projects: [{ name: "telephone", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } }],
});
