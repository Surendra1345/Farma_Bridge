import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = { title: string; onClose: () => void; children: ReactNode; side?: "bottom" | "right"; wide?: boolean };

/** Modal surface: bottom sheet on mobile, centered dialog on desktop, or right drawer. */
export function Sheet({ title, onClose, children, side = "bottom", wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const position =
    side === "right"
      ? "right-0 top-0 h-dvh w-72"
      : `inset-x-0 bottom-0 mx-auto ${wide ? "max-w-2xl" : "max-w-lg"} rounded-t-3xl md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/40" onClick={onClose} aria-hidden />
      <section role="dialog" aria-modal="true" aria-label={title} className={`fixed z-50 w-full overflow-y-auto bg-white p-6 shadow-2xl max-h-[92dvh] ${position}`}>
        <button className="icon-button absolute right-4 top-4" aria-label="Close" onClick={onClose}><X size={20} /></button>
        {children}
      </section>
    </>
  );
}
