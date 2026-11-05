// Génère des relevés CSV FICTIFS qui imitent la forme des exports de 7 banques canadiennes.
// Mêmes transactions dans chaque fichier : août à octobre 2026 complets + début novembre.
// Usage : node scripts/generer-releves.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const DOSSIER = new URL("../tests/fixtures/releves/", import.meta.url);
mkdirSync(DOSSIER, { recursive: true });

/** [jour, libellé, montant en cents] — négatif = sortie */
function mois(a, m, k) {
  const l = [
    [1, "VIREMENT INTERAC LOYER PROPRIETAIRE", -105000],
    [2, "DEPOT DIRECT PAIE EMPLOYEUR", 145000],
    [3, "RTC CARTE OPUS", -9700],
    [4, "VIREMENT VERS EPARGNE", -30000],
    [5, "MAXI #8812 QUEBEC", -(8800 + k * 300)],
    [8, "VIDEOTRON LTEE", -8500],
    [9, "NETFLIX.COM", -1899],
    [11, "SPOTIFY P2F3", -1299],
    [12, "HYDRO-QUEBEC PAIEMENT", -(6200 + k * 400)],
    [13, "IGA EXTRA 0421", -(9600 + k * 500)],
    [15, "TIM HORTONS #2231", -(950 + k * 100)],
    [16, "DEPOT DIRECT PAIE EMPLOYEUR", 145000],
    [18, "REMITLY TRANSFERT", -15000],
    [22, "RESTAURANT CHEZ ASHTON", -(2400 + k * 300)],
    [27, "METRO PLUS", -(6500 + k * 200)],
    [28, "FRAIS MENSUELS FORFAIT", -495],
  ];
  if (k === 1) l.push([21, "INTERETS CARTE DE CREDIT", -1182]);
  if (k === 2) l.push([14, "AMAZON.COM USD", -6420], [14, "FRAIS DE CONVERSION DEVISE", -161]);
  // Deux cafés identiques le même jour : ils doivent rester deux transactions distinctes.
  if (k === 3) l.push([15, "TIM HORTONS #2231", -(950 + k * 100)], [24, "CANADIAN TIRE 0442", -5850]);
  return l.map(([j, lib, c]) => ({ a, m, j, lib, c }));
}
const tx = [...mois(2026, 8, 1), ...mois(2026, 9, 2), ...mois(2026, 10, 3)];
tx.push({ a: 2026, m: 11, j: 2, lib: "DEPOT DIRECT PAIE EMPLOYEUR", c: 145000 });
tx.push({ a: 2026, m: 11, j: 3, lib: "MAXI #8812 QUEBEC", c: -9150 });
tx.sort((x, y) => x.m - y.m || x.j - y.j);

const p2 = (n) => String(n).padStart(2, "0");
const pt = (c) => (Math.abs(c) / 100).toFixed(2); // 1050.00
const vf = (c) => pt(c).replace(".", ","); // 1050,00
const vfMilliers = (c) => vf(c).replace(/^(\d+)(\d{3}),/, "$1 $2,"); // 1 050,00
let solde = 345678;
const soldes = tx.map((t) => (solde += t.c));
const ecrire = (nom, lignes) => writeFileSync(new URL(nom, DOSSIER), lignes.join("\r\n") + "\r\n");

// Desjardins (AccèsD) : sans en-tête, virgules, guillemets, AAAA/MM/JJ, retrait et dépôt séparés, n° de séquence.
ecrire(
  "desjardins.csv",
  tx.map((t, i) =>
    [`"815-30123"`, `"EOP-1"`, `"EOP"`, `"${t.a}/${p2(t.m)}/${p2(t.j)}"`, String(i + 1).padStart(5, "0"), `"${t.lib}"`, `""`,
     t.c < 0 ? pt(t.c) : "", t.c > 0 ? pt(t.c) : "", "", pt(soldes[i])].join(","),
  ),
);

// Banque Nationale : en-tête, point-virgule, JJ/MM/AAAA, montants « 1 050,00 », débit et crédit séparés.
ecrire("banque-nationale.csv", [
  "Date;Description;Catégorie;Débit;Crédit;Solde",
  ...tx.map((t, i) =>
    [`${p2(t.j)}/${p2(t.m)}/${t.a}`, t.lib, "", t.c < 0 ? vfMilliers(t.c) : "", t.c > 0 ? vfMilliers(t.c) : "", vfMilliers(soldes[i])].join(";"),
  ),
]);

// RBC : en-tête anglais du fichier bancaire, M/J/AAAA, un montant signé (CAD$).
ecrire("rbc.csv", [
  `"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"`,
  ...tx.map((t) => [`Chequing`, `01234-5678901`, `${t.m}/${t.j}/${t.a}`, ``, `"${t.lib}"`, ``, (t.c / 100).toFixed(2), ``].join(",")),
]);

// TD : sans en-tête, MM/JJ/AAAA, débit, crédit, solde.
ecrire("td.csv", tx.map((t, i) => [`${p2(t.m)}/${p2(t.j)}/${t.a}`, t.lib, t.c < 0 ? pt(t.c) : "", t.c > 0 ? pt(t.c) : "", pt(soldes[i])].join(",")));

// BMO : ligne d'avertissement, ligne vide, en-tête, date AAAAMMJJ, montant signé.
ecrire("bmo.csv", [
  "Following data is valid as of 20261104120000 (Year/Month/Day/Hour/Minute/Second)",
  "",
  "First Bank Card,Transaction Type,Date Posted, Transaction Amount,Description",
  ...tx.map((t) => [`'5191230000001234'`, t.c < 0 ? "DEBIT" : "CREDIT", `${t.a}${p2(t.m)}${p2(t.j)}`, (t.c / 100).toFixed(2), `[CW] ${t.lib}`].join(",")),
]);

// Scotia : sans en-tête, M/J/AAAA, montant signé, colonne « - », type, description.
ecrire("scotia.csv", tx.map((t) => [`${t.m}/${t.j}/${t.a}`, (t.c / 100).toFixed(2), "-", t.c < 0 ? "DEBIT" : "CREDIT", t.lib].join(",")));

// Tangerine : en-tête français, M/J/AAAA, nom et note séparés, montant signé.
ecrire("tangerine.csv", [
  "Date de l'opération,Opération,Nom,Description,Montant",
  ...tx.map((t) => [`${t.m}/${t.j}/${t.a}`, t.c < 0 ? "DEBIT" : "CREDIT", `"${t.lib}"`, `"Opération, compte chèques"`, (t.c / 100).toFixed(2)].join(",")),
]);

// Référence commune : ce que chaque fichier doit donner.
writeFileSync(
  new URL("attendu.json", DOSSIER),
  JSON.stringify(tx.map((t) => ({ date: `${t.a}-${p2(t.m)}-${p2(t.j)}`, libelle: t.lib, montant: t.c })), null, 1) + "\n",
);
console.log(`${tx.length} transactions × 7 relevés`);
