import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Variables publiques du projet (URL Supabase) ; les secrets viennent de l'environnement.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* fichier absent : variables déjà dans l'environnement */
}

// Navigateur préinstallé dans le conteneur de développement ; ailleurs, Playwright utilise le sien.
const chromium = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(chromium) ? chromium : undefined;
const PORT = 3100;

export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "parite/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "telephone", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
