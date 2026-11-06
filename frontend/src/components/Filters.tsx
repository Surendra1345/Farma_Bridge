import { Search } from "lucide-react";
import { CROP_CATEGORIES } from "../sections";

type Props = {
  noun: string; search: string; onSearch: (v: string) => void;
  showCategories: boolean; category: string; onCategory: (v: string) => void;
};

export function Filters({ noun, search, onSearch, showCategories, category, onCategory }: Props) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 rounded-2xl border border-[#d8dfce] bg-white px-4 py-3 shadow-sm focus-within:border-[#1d5a2b] focus-within:ring-2 focus-within:ring-[#1d5a2b]/20">
        <Search className="shrink-0 text-slate-400" size={20} />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={`Search ${noun} by name or location`}
          className="w-full bg-transparent outline-none placeholder:text-slate-400" aria-label={`Search ${noun}`} />
      </label>
      {showCategories && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CROP_CATEGORIES.map((item) => (
            <button key={item} onClick={() => onCategory(item)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${category === item ? "border-[#1d5a2b] bg-[#1d5a2b] text-white" : "border-[#d4dacb] bg-white text-slate-600 hover:border-[#1d5a2b]"}`}>
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
