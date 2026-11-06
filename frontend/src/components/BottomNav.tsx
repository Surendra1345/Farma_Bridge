import { CircleUserRound, PackagePlus } from "lucide-react";
import { SECTIONS, type Section } from "../sections";

type Props = { section: Section; onSection: (s: Section) => void; onPost: () => void; onAccount: () => void };

/** Mobile-only tab bar. */
export function BottomNav({ section, onSection, onPost, onAccount }: Props) {
  const tab = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
      <div className="mx-auto flex max-w-md items-end">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onSection(key)} aria-current={section === key} className={`${tab} ${section === key ? "text-[#1d5a2b]" : "text-slate-500"}`}>
            <Icon size={22} />{label}
          </button>
        ))}
        <button onClick={onPost} className={`${tab} text-slate-500`}><PackagePlus size={22} />Post</button>
        <button onClick={onAccount} className={`${tab} text-slate-500`}><CircleUserRound size={22} />Account</button>
      </div>
    </nav>
  );
}
