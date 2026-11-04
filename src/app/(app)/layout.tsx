import { EnTete, NavigationBas } from "@/ui/navigation";
import { FournisseurSession } from "@/ui/session";

/** Coquille statique (en-tête + onglets) affichée tout de suite ; les données arrivent ensuite. */
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <>
      <EnTete />
      <main id="contenu" className="mx-auto max-w-3xl px-4 pt-4 pb-28">
        <FournisseurSession>{children}</FournisseurSession>
      </main>
      <NavigationBas />
    </>
  );
}
