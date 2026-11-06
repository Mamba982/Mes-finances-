/**
 * Masquage des numéros de compte et de carte avant tout envoi à un service externe (Loi 25 : minimisation).
 *
 * Est masquée toute suite d'au moins 7 chiffres, d'un seul bloc ou en groupes séparés par une espace
 * ou un trait d'union (« 4520 1234 5678 9012 », « 12345-003-1234567 »). Restent intacts : les numéros
 * de magasin courts (« MAXI #8812 »), les numéros déjà masqués (« ****1234 »), les dates ISO
 * (« 2026-10-05 ») et les montants (« 1 234 567,89 », suivis de décimales).
 */
export const NUMERO_MASQUE = "[numéro masqué]";

const SUITE = /(?<![\d,.])\d+(?:[ -]\d+)*(?![\d]|[,.]\d)/g;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function masquerNumeros(texte: string): string {
  return texte.replace(SUITE, (bloc) => {
    if (DATE_ISO.test(bloc)) return bloc;
    const chiffres = bloc.replace(/\D/g, "").length;
    return chiffres >= 7 ? NUMERO_MASQUE : bloc;
  });
}
