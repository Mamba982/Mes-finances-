import { pathToFileURL } from "node:url";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** URL du prototype, exécuté tel quel comme référence de calcul. */
export const PROTOTYPE = pathToFileURL(join(import.meta.dirname, "../../prototype/index.html")).href;

/** Ouvre le prototype avec l'horloge figée (midi, heure de l'Est) pour que « aujourd'hui » soit stable. */
export async function ouvrirPrototype(page: Page, aujourdhui: string): Promise<void> {
  await page.clock.setFixedTime(new Date(`${aujourdhui}T12:00:00-05:00`));
  await page.goto(PROTOTYPE);
  await page.waitForFunction(() => "__fin" in window);
}

/** Transaction au format du prototype (montants en dollars, catégorie = code). */
export interface TxPrototype {
  id: string;
  date: string;
  libelle: string;
  marchand: string;
  montant: number;
  categorie: string | null;
}
