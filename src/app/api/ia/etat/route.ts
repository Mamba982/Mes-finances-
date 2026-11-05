import { configIa } from "@/ia/config";

/** Indique si l'IA est configurée sur ce serveur (sans révéler aucune valeur). */
export async function GET() {
  return Response.json({ disponible: configIa().disponible }, { headers: { "Cache-Control": "no-store" } });
}
