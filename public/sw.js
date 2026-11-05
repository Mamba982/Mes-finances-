/* Service worker de Mes finances.
 * - Fichiers statiques de Next (/_next/static, noms à empreinte) : cache d'abord.
 * - Pages et données de navigation de l'application : réseau d'abord, cache si hors ligne.
 * - Jamais mis en cache : autres domaines (Supabase), /api, /auth, requêtes autres que GET.
 * Les données financières ne passent pas par ce cache : elles vivent dans la copie IndexedDB,
 * effacée à la déconnexion.
 */
const VERSION = "v1";
const STATIQUE = `statique-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ESSENTIEL = ["/accueil", "/connexion", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(ESSENTIEL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== STATIQUE && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheDAbord(req) {
  const cache = await caches.open(STATIQUE);
  const trouve = await cache.match(req);
  if (trouve) return trouve;
  const rep = await fetch(req);
  if (rep.ok) cache.put(req, rep.clone());
  return rep;
}

async function reseauDAbord(req) {
  const cache = await caches.open(PAGES);
  try {
    const rep = await fetch(req);
    if (rep.ok && rep.type === "basic") cache.put(req, rep.clone());
    return rep;
  } catch (erreur) {
    const trouve = (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("/accueil") : undefined);
    if (trouve) return trouve;
    throw erreur;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(cacheDAbord(req));
    return;
  }
  e.respondWith(reseauDAbord(req));
});
