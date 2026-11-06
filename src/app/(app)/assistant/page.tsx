import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { Assistant } from "./assistant";

export const metadata: Metadata = { title: T.nav.assistant };

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-extrabold">{T.nav.assistant}</h1>
      <Assistant />
    </>
  );
}
