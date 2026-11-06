import { Bell, Menu, Sprout } from "lucide-react";
import { useAuth } from "../auth";
import { SECTIONS, type Section } from "../sections";

type Props = { section: Section; onSection: (s: Section) => void; onMenu: () => void; onAccount: () => void };

export function Header({ section, onSection, onMenu, onAccount }: Props) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f7f8f3]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:px-10">
        <button className="flex items-center gap-2.5" onClick={() => onSection("crops")} aria-label="AgriLink home">
          <span className="grid size-10 place-items-center rounded-xl bg-[#1d5a2b] text-white"><Sprout size={22} /></span>
          <span className="font-display text-xl font-extrabold tracking-tight text-[#174d24]">AgriLink</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Marketplace sections">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => onSection(key)} aria-current={section === key}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${section === key ? "bg-[#e3f0de] text-[#1d5a2b]" : "text-slate-600 hover:bg-white"}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
          <button className="hidden rounded-full bg-[#1d5a2b] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#174d24] md:block" onClick={onAccount}>{user ? user.name.split(" ")[0] : "Sign in"}</button>
          <button className="icon-button md:hidden" aria-label="Open menu" onClick={onMenu}><Menu size={22} /></button>
        </div>
      </div>
    </header>
  );
}
