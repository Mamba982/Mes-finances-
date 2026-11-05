import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import { T } from "@/textes/fr-CA";
import { EnregistrementServiceWorker } from "@/ui/service-worker";
import "./globals.css";

const titre = Manrope({ variable: "--police-titre", subsets: ["latin"], weight: ["600", "700", "800"] });
const texte = Source_Sans_3({ variable: "--police-texte", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: T.app.nom, template: `%s · ${T.app.nom}` },
  description: T.app.description,
  applicationName: T.app.nom,
  appleWebApp: { capable: true, title: T.app.nom, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1513" },
  ],
};

/** Applique le thème choisi avant le premier rendu (aucun flash). */
const scriptTheme = `try{var t=localStorage.getItem("theme");if(t==="clair")document.documentElement.dataset.theme="light";else if(t==="sombre")document.documentElement.dataset.theme="dark";}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CA" className={`${titre.variable} ${texte.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-surface focus:p-2">
          {T.app.lienEvitement}
        </a>
        {children}
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
