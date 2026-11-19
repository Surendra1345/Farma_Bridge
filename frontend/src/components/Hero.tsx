import { Leaf, PackagePlus, Stethoscope } from "lucide-react";

export function Hero({ onStartSelling, onCropDoctor }: { onStartSelling: () => void; onCropDoctor: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d5a2b] to-[#2f7a3d] px-6 py-8 text-white md:flex md:items-center md:justify-between md:px-10 md:py-10">
      <div className="relative max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Leaf size={14} /> Direct from local producers</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">Grow, trade and find what your farm needs.</h1>
        <p className="mt-3 text-sm leading-6 text-green-50/90">Browse freely. Sign in only when you want to sell, buy or book.</p>
      </div>
      <div className="relative mt-6 flex flex-wrap gap-3 md:mt-0 md:flex-col">
        <button onClick={onStartSelling} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff962e] px-6 py-3 text-sm font-bold text-[#1e3a22] transition hover:bg-[#ffab59]">
          <PackagePlus size={19} /> Start selling
        </button>
        <button onClick={onCropDoctor} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20">
          <Stethoscope size={19} /> Crop Doctor
        </button>
      </div>
      <Leaf className="pointer-events-none absolute -right-6 -top-6 size-48 rotate-12 text-white/5" aria-hidden />
    </div>
  );
}
