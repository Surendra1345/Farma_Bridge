import { AlertCircle, SearchX, type LucideIcon } from "lucide-react";

export function LoadingCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {[1, 2, 3].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />)}
    </div>
  );
}

function Notice({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border-2 border-dashed border-[#ccd9c4] bg-white/60 p-6 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf5e9] text-[#266330]"><Icon size={24} /></span>
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
        {action && <button onClick={action.onClick} className="mt-4 rounded-lg border border-[#1d5a2b] px-4 py-2 text-sm font-semibold text-[#1d5a2b] hover:bg-[#eaf4e5]">{action.label}</button>}
      </div>
    </div>
  );
}

export const EmptyState = ({ noun, filtered, onClear }: { noun: string; filtered: boolean; onClear: () => void }) =>
  filtered
    ? <Notice icon={SearchX} title={`No ${noun} match your search`} text="Try a different keyword or category." action={{ label: "Clear filters", onClick: onClear }} />
    : <Notice icon={SearchX} title={`No ${noun} listed yet`} text="Be the first to add one." />;

export const ErrorState = ({ onRetry }: { onRetry: () => void }) =>
  <Notice icon={AlertCircle} title="Couldn't load listings" text="Check that the API is running, then try again." action={{ label: "Retry", onClick: onRetry }} />;
