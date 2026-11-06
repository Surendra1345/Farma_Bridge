import { MapPin, type LucideIcon } from "lucide-react";
import { mediaUrl } from "../api";

type Props = {
  title: string; subtitle?: string; location: string; price: string; priceUnit: string;
  image?: string | null; fallbackIcon: LucideIcon; badge?: string; actionLabel: string; onAction: () => void;
  /** Your own listing: no buy/book button, a Manage button instead. */
  own?: boolean; onManage?: () => void;
  /** Set when the listing can't be booked/bought right now; shown on a disabled button. */
  unavailable?: string;
};

export function ListingCard({ title, subtitle, location, price, priceUnit, image, fallbackIcon: Icon, badge, actionLabel, onAction, own, onManage, unavailable }: Props) {
  const src = mediaUrl(image);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/10] bg-gradient-to-br from-[#e3efd5] to-[#bfd6a0]">
        {src
          ? <img src={src} alt={title} loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-[#2f6b36]/60"><Icon size={56} strokeWidth={1.5} /></div>}
        {own && <span className="absolute right-3 top-3 rounded-full bg-[#ff962e] px-3 py-1 text-xs font-bold text-[#1e3a22] shadow-sm">Your listing</span>}
        {badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#1d5a2b] shadow-sm">{badge}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold leading-tight">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <p className="shrink-0 text-right text-lg font-extrabold leading-tight text-[#d8731c]">{price}<span className="block text-xs font-medium text-slate-500">{priceUnit}</span></p>
        </div>
        <p className="mb-5 mt-3 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={16} className="shrink-0" /><span className="truncate">{location}</span></p>
        {own
          ? <button onClick={onManage} className="mt-auto w-full rounded-xl border border-[#1d5a2b] py-3 text-sm font-bold text-[#1d5a2b] transition hover:bg-[#eaf4e5]">Manage my listing</button>
          : unavailable
          ? <button disabled className="mt-auto w-full cursor-not-allowed rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-500">{unavailable}</button>
          : <button onClick={onAction} className="mt-auto w-full rounded-xl bg-[#1d5a2b] py-3 text-sm font-bold text-white transition hover:bg-[#174d24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d5a2b]">{actionLabel}</button>}
      </div>
    </article>
  );
}
