// Fabrique la photo d'un reçu fictif (commerce et montants inventés) pour l'essai de lecture.
// Usage : node scripts/generer-recu.mjs
import { existsSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#ddd">
<div style="width:320px;margin:20px auto;padding:18px;background:#fff;font:14px 'Courier New',monospace;transform:rotate(-1.5deg)">
<center><b>PAPETERIE FICTIVE DES ÉRABLES</b><br>1234, rue Inventée, Québec QC<br>TPS 123456789 RT0001<br>TVQ 1234567890 TQ0001</center><br>
2026-10-12 14:32 &nbsp; Caisse 3<br><br>
Papier 8,5x11 (2) &nbsp;&nbsp;&nbsp;&nbsp; 24,98<br>Cartouche d'encre &nbsp;&nbsp;&nbsp;&nbsp; 24,99<br>
<br>Sous-total &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 49,97<br>TPS 5 % &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 2,50<br>TVQ 9,975 % &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 4,98<br>
<b>TOTAL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 57,45</b><br><br>
VISA ************1234 &nbsp; APPROUVÉE<br><br><center>Merci de votre visite !</center></div>`;
const executablePath = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const b = await chromium.launch({ executablePath });
const p = await b.newPage({ viewport: { width: 400, height: 560 } });
await p.setContent(html);
writeFileSync(new URL("../tests/fixtures/recus/recu-fictif.png", import.meta.url), await p.screenshot());
await b.close();
writeFileSync(
  new URL("../tests/fixtures/recus/recu-fictif.attendu.json", import.meta.url),
  JSON.stringify({ date: "2026-10-12", marchand: "PAPETERIE FICTIVE DES ÉRABLES", total: 5745, tps: 250, tvq: 498 }, null, 1) + "\n",
);
