import { SECTIONS, type Section } from "../sections";
import { Sheet } from "./Sheet";

export function MenuSheet({ onClose, onSection }: { onClose: () => void; onSection: (s: Section) => void }) {
  return (
    <Sheet title="Menu" side="right" onClose={onClose}>
      <p className="mt-10 text-xs font-bold tracking-widest text-[#d8731c]">EXPLORE</p>
      {SECTIONS.map(({ key, label, icon: Icon }) => (
        <button key={key} className="flex w-full items-center gap-3 border-b py-4 text-left font-semibold" onClick={() => { onSection(key); onClose(); }}>
          <Icon size={20} />{label}
        </button>
      ))}
    </Sheet>
  );
}
