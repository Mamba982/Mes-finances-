// Fabrique un relevé PDF fictif de 5 pages (banque, personne et numéros inventés) et la liste attendue.
// Usage : node scripts/generer-releve-pdf.mjs   (Chromium de Playwright)
import { existsSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const MARCHANDS = [
  ["MAXI #8812 QUEBEC", -1], ["DOLLARAMA #1234 LAVAL", -1], ["TIM HORTONS #4512", -1], ["STM CARTE OPUS", -1],
  ["VIDEOTRON LTEE", -1], ["PETRO-CANADA 8812", -1], ["COSTCO WHOLESALE #503", -1], ["SPOTIFY P1A2B3", -1],
  ["PHARMAPRIX 0345", -1], ["RESTAURANT CHEZ LÉO", -1], ["HYDRO-QUEBEC", -1], ["AMAZON.CA MARKETPLACE", -1],
  ["DEPOT PAIE EMPLOYEUR ABC INC", 1], ["VIREMENT INTERAC REÇU", 1], ["FRAIS MENSUELS FORFAIT", -1], ["SAQ SELECTION 23045", -1],
];
const MOIS = ["AOÛ", "SEP", "OCT"];
let graine = 42;
const hasard = () => ((graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const lignes = [];
let solde = 312045; // cents
for (let i = 0; i < 110; i++) {
  const m = Math.floor((i / 110) * 3);
  const jour = 1 + Math.floor(((i % 37) / 37) * 28);
  const [libelle, sens] = MARCHANDS[Math.floor(hasard() * MARCHANDS.length)];
  const montant = sens * (sens > 0 ? 50000 + Math.floor(hasard() * 180000) : 300 + Math.floor(hasard() * 25000));
  solde += montant;
  lignes.push({ date: `2026-${String(8 + m).padStart(2, "0")}-${String(jour).padStart(2, "0")}`, jourTexte: `${String(jour).padStart(2, "0")} ${MOIS[m]}`, libelle, montant, solde });
}
lignes.sort((a, b) => a.date.localeCompare(b.date));
solde = 312045;
for (const l of lignes) l.solde = solde += l.montant;

const fmt = (c) => (Math.abs(c) / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const page = (rangs, n) => `
  <section>
    <header><b>Caisse Fictive des Érables</b> — Relevé de compte chèques<br>
    Titulaire : Alex Exemple · Compte 81234-815-0123456 · Période du 1er août au 31 octobre 2026 · Page ${n} de 5</header>
    <table><thead><tr><th>Date</th><th>Description</th><th class="m">Retraits</th><th class="m">Dépôts</th><th class="m">Solde</th></tr></thead>
    <tbody>${n === 1 ? `<tr><td></td><td>SOLDE REPORTÉ</td><td></td><td></td><td class="m">${fmt(312045)}</td></tr>` : ""}
    ${rangs.map((l) => `<tr><td>${l.jourTexte}</td><td>${l.libelle}</td><td class="m">${l.montant < 0 ? fmt(l.montant) : ""}</td><td class="m">${l.montant > 0 ? fmt(l.montant) : ""}</td><td class="m">${fmt(l.solde)}</td></tr>`).join("")}
    ${n === 5 ? `<tr><td></td><td>SOLDE DE FERMETURE</td><td></td><td></td><td class="m">${fmt(solde)}</td></tr>` : ""}
    </tbody></table>
  </section>`;
const html = `<!doctype html><html lang="fr-CA"><meta charset="utf-8"><style>
  body{font:9pt Arial,sans-serif;margin:0} section{page-break-after:always;padding:24px}
  header{margin-bottom:12px} table{width:100%;border-collapse:collapse} th,td{padding:3px 6px;text-align:left}
  th{border-bottom:1px solid #000} .m{text-align:right}
</style>${[0, 1, 2, 3, 4].map((p) => page(lignes.slice(p * 22, p * 22 + 22), p + 1)).join("")}</html>`;

const executablePath = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const navigateur = await chromium.launch({ executablePath });
const p = await navigateur.newPage();
await p.setContent(html);
const sortie = new URL("../tests/fixtures/releves/releve-5-pages.pdf", import.meta.url);
writeFileSync(sortie, await p.pdf({ format: "Letter", printBackground: false }));
await navigateur.close();
writeFileSync(
  new URL("../tests/fixtures/releves/releve-5-pages.attendu.json", import.meta.url),
  JSON.stringify(lignes.map(({ date, libelle, montant }) => ({ date, libelle, montant })), null, 1) + "\n",
);
console.log(`${lignes.length} transactions, 5 pages`);
