import type { Metadata } from "next";
import { Suspense } from "react";
import { T } from "@/textes/fr-CA";
import { VueBudget } from "./vue";

export const metadata: Metadata = { title: T.nav.budget };

export default function PageBudget() {
  return (
    <Suspense fallback={<p className="note py-10 text-center">{T.session.chargement}</p>}>
      <VueBudget />
    </Suspense>
  );
}
