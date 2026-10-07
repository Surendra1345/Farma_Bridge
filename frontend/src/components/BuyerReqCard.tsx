import { Calendar, FileText, MapPin, Pencil } from "lucide-react";
import type { BuyerRequirement } from "../types";

export function BuyerReqCard({
  req,
  onRespond,
  isOwner,
  onEdit,
}: {
  req: BuyerRequirement;
  onRespond: () => void;
  isOwner?: boolean;
  onEdit?: () => void;
}) {
  const isExpired = new Date(req.deadline).getTime() < Date.now();

  return (
    <article className="overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-[0_12px_35px_-22px_rgba(28,41,31,.25)] flex flex-col justify-between transition hover:shadow-md">
      <div className="p-5">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[11px] font-bold">
                <FileText className="size-3" />
                Buyer Requirement
              </span>
              {isOwner && (
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                  Your Post
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold mt-2 text-slate-900 leading-tight">
              {req.crop_type}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Quantity Needed: <strong className="text-slate-800 font-bold">{req.quantity_needed} {req.unit}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Max Budget</span>
            <span className="text-lg font-extrabold text-[#d8731c]">
              {req.budget_max ? `₹${req.budget_max}` : "Negotiable"}
            </span>
            {req.budget_max && <span className="text-[10px] text-slate-400 block">/ {req.unit}</span>}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-slate-400 shrink-0" />
            <span>Delivery: {req.delivery_location}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-slate-400 shrink-0" />
            <span>
              Deadline:{" "}
              <strong className={isExpired ? "text-red-600" : "text-slate-800"}>
                {new Date(req.deadline).toLocaleDateString()}
              </strong>
            </span>
          </p>
        </div>
      </div>

      <div className="p-5 pt-0 flex gap-2">
        {isOwner && onEdit ? (
          <button
            onClick={onEdit}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Pencil className="size-3.5" />
            <span>Edit Demand</span>
          </button>
        ) : null}
        <button
          onClick={onRespond}
          className={`${isOwner ? "w-1/2" : "w-full"} py-3 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition flex items-center justify-center gap-1.5`}
        >
          <span>{isOwner ? "View Offers" : "Respond with Harvest Offer"}</span>
        </button>
      </div>
    </article>
  );
}
