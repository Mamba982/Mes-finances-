// Génère les icônes de l'application (PNG) à partir d'un dessin SVG, avec le Chromium de Playwright.
// Usage : node scripts/generer-icones.mjs
import { existsSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const vert = "#0e6b5c";
// Trois barres montantes : sobre, lisible à 32 px, sans symbole ambigu.
const dessin = (marge) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${marge ? 0 : 112}" fill="${vert}"/>
  <g transform="translate(256 256) scale(${marge ? 0.72 : 1}) translate(-256 -256)" fill="#fff">
    <rect x="112" y="276" width="76" height="132" rx="18"/>
    <rect x="218" y="196" width="76" height="212" rx="18"/>
    <rect x="324" y="104" width="76" height="304" rx="18"/>
  </g>
</svg>`;

writeFileSync(new URL("../src/app/icon.svg", import.meta.url), dessin(false).trim() + "\n");
const executablePath = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const b = await chromium.launch({ executablePath });
const p = await b.newPage();
for (const [nom, taille, marge] of [
  ["public/icones/icone-192.png", 192, false],
  ["public/icones/icone-512.png", 512, false],
  ["public/icones/icone-masquable-512.png", 512, true],
  ["src/app/apple-icon.png", 180, true],
]) {
  await p.setViewportSize({ width: taille, height: taille });
  await p.setContent(`<html><body style="margin:0">${dessin(marge).replace("<svg ", `<svg width="${taille}" height="${taille}" `)}</body></html>`);
  await p.screenshot({ path: nom, omitBackground: false });
}
await b.close();
console.log("icônes générées");
