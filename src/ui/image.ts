/**
 * Réduit une photo de reçu avant l'envoi (côté le plus long : 1600 px, JPEG 80 %).
 * Une photo de téléphone passe d'environ 4 Mo à environ 300 Ko : envoi rapide en 4G.
 */
export async function compresserImage(fichier: Blob, cote = 1600, qualite = 0.8): Promise<Blob> {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("compression"))), "image/jpeg", qualite));
}
