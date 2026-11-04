import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Mots anglais qui trahiraient un texte non traduit (bibliothèque, page par défaut, message natif). */
const MOTS_ANGLAIS =
  /\b(the|and|loading|error|submit|sign ?in|sign ?up|log ?in|email address|password|welcome|settings|cancel|save|delete|next|previous|search|please|required|invalid|not found|something went wrong|try again)\b/i;

export async function sansTexteAnglais(page: Page): Promise<void> {
  const texte = await page.locator("body").innerText();
  const titre = await page.title();
  expect(`${titre}\n${texte}`).not.toMatch(MOTS_ANGLAIS);
}

/** Vérification automatique WCAG 2.2 A et AA (ne remplace pas un test manuel au lecteur d'écran). */
export async function accessible(page: Page): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} : ${v.help} (${v.nodes.length})`)).toEqual([]);
}
