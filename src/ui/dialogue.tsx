"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Fenêtre modale native (<dialog>) : piège du focus, touche Échap et retour du focus gérés par le navigateur. */
export function Dialogue({ ouvert, titre, onFermer, children }: { ouvert: boolean; titre: string; onFermer: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitre = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      onClose={onFermer}
      onClick={(e) => {
        if (e.target === ref.current) onFermer();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-black/45 sm:inset-y-0 sm:m-auto sm:max-w-xl sm:rounded-2xl"
    >
      <div className="px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 id={idTitre} className="mb-3 text-lg font-bold">
          {titre}
        </h2>
        {ouvert ? children : null}
      </div>
    </dialog>
  );
}
