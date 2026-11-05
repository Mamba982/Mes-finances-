import { formaterMontant } from "@/domaine/argent";
import { libelleDate } from "@/domaine/dates";
import { totalFacture, type Facture } from "@/domaine/factures";
import type { Profil } from "@/donnees/profil";
import { T } from "@/textes/fr-CA";

const d = T.facture.document;
const taux = (n: number) => String(n).replace(".", ",");

/** Texte brut de la facture, à coller dans un courriel (format du prototype). */
export function texteFacture(f: Facture, p: Profil | null): string {
  const m = (c: number) => formaterMontant(c, 2, p?.devise ?? "CAD");
  const lignes = [
    p?.entreprise_nom ?? "",
    p?.entreprise_adresse ?? "",
    "",
    `${d.facture} ${f.numero}`,
    `${d.date} : ${libelleDate(f.date)}`,
    ...(f.echeance ? [`${d.echeance} : ${libelleDate(f.echeance)}`] : []),
    "",
    `${d.factureA} : ${f.client}${f.courriel ? ` <${f.courriel}>` : ""}`,
    "",
    `${d.description} : ${f.description}`,
    `${d.avantTaxes} : ${m(f.montantHt)}`,
  ];
  if (f.taxable) {
    lignes.push(`TPS (${taux(f.tauxTps)} %)${p?.no_tps ? ` ${d.numero} ${p.no_tps}` : ""} : ${m(f.tps)}`);
    lignes.push(`TVQ (${taux(f.tauxTvq)} %)${p?.no_tvq ? ` ${d.numero} ${p.no_tvq}` : ""} : ${m(f.tvq)}`);
  }
  lignes.push(`${d.total} : ${m(totalFacture(f))}`, "", d.interac);
  return lignes.join("\n");
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Document HTML autonome de la facture (téléchargeable, imprimable en PDF depuis le navigateur). */
export function htmlFacture(f: Facture, p: Profil | null): string {
  const m = (c: number) => echapper(formaterMontant(c, 2, p?.devise ?? "CAD"));
  const e = echapper;
  const taxesHtml = f.taxable
    ? `<tr><td>TPS ${taux(f.tauxTps)} %${p?.no_tps ? ` (${d.numero} ${e(p.no_tps)})` : ""}</td><td class="n">${m(f.tps)}</td></tr>` +
      `<tr><td>TVQ ${taux(f.tauxTvq)} %${p?.no_tvq ? ` (${d.numero} ${e(p.no_tvq)})` : ""}</td><td class="n">${m(f.tvq)}</td></tr>`
    : "";
  return `<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"><title>${e(T.facture.titre(f.numero))}</title>
<style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#111;padding:0 20px}h1{font-size:26px;margin:28px 0 4px}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:8px;border-bottom:1px solid #ddd}td.n{text-align:right}.t td{font-weight:bold;border-top:2px solid #111}.m{color:#555;font-size:14px}</style>
</head><body><div><b>${e(p?.entreprise_nom ?? "")}</b><div class="m">${e(p?.entreprise_adresse ?? "")}</div></div>
<h1>${e(T.facture.titre(f.numero))}</h1><div class="m">${d.date} : ${e(libelleDate(f.date))}${f.echeance ? ` · ${d.echeance} : ${e(libelleDate(f.echeance))}` : ""}</div>
<p><b>${d.factureA} :</b> ${e(f.client)}${f.courriel ? `<br><span class="m">${e(f.courriel)}</span>` : ""}</p>
<table><tr><td>${e(f.description)}</td><td class="n">${m(f.montantHt)}</td></tr>${taxesHtml}<tr class="t"><td>Total</td><td class="n">${m(totalFacture(f))}</td></tr></table>
<p class="m" style="margin-top:28px">${d.interac}</p></body></html>`;
}
