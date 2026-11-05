import type { MetadataRoute } from "next";
import { T } from "@/textes/fr-CA";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: T.app.nom,
    short_name: T.app.nom,
    description: T.app.description,
    lang: "fr-CA",
    dir: "ltr",
    start_url: "/accueil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f4",
    theme_color: "#0e6b5c",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
