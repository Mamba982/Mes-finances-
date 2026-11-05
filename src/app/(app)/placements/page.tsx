import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { VuePlacements } from "./vue";

export const metadata: Metadata = { title: T.nav.placements };

export default function PagePlacements() {
  return <VuePlacements />;
}
