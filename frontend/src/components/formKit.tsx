import { useState, type ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { labelClass, primaryClass } from "./formStyles";

/** Shared submit plumbing: busy flag, error text, success message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setError("");
    try { setDone(await fn()); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  return { busy, error, done, run, reset: () => setDone("") };
}

export function Done({ message, onClose, button = "Done", secondary }: { message: string; onClose: () => void; button?: string; secondary?: { label: string; onClick: () => void } }) {
  return (
    <div className="py-4 text-center">
      <CheckCircle2 className="mx-auto text-[#1d5a2b]" size={48} />
      <p className="mt-3 text-lg font-bold">{message}</p>
      <button className={`${primaryClass} mt-6`} onClick={onClose}>{button}</button>
      {secondary && <button className="mt-3 w-full py-2 text-sm font-semibold text-[#1d5a2b] underline" onClick={secondary.onClick}>{secondary.label}</button>}
    </div>
  );
}

/** A real <label>, so inputs are named for screen readers and focus on click. */
export const Field = ({ name, children }: { name: string; children: ReactNode }) =>
  <label className="block"><span className={labelClass}>{name}</span><span className="mt-1 block">{children}</span></label>;

export const Submit = ({ busy, children }: { busy: boolean; children: ReactNode }) =>
  <button className={primaryClass} disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}{children}</button>;
