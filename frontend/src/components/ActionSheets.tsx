import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tradeApi } from "../api";
import { useAuth } from "../auth";
import type { CropListing, MachineListing, StorageListing } from "../types";
import { FormError } from "./AuthSheet";
import { Done, Field, Submit, useAction } from "./formKit";
import { inputClass as input } from "./formStyles";
import { ListingForm, type ListingKind } from "./ListingForm";
import { Sheet } from "./Sheet";

/* ---------------------------------------------------------------- Buy */
export function BuySheet({ crop, onClose, onViewOrders }: { crop: CropListing; onClose: () => void; onViewOrders: () => void }) {
  const { ensureRole } = useAuth();
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");
  const { busy, error, done, run } = useAction();
  const amount = Number(qty) || 0;
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    await ensureRole("buyer");
    await tradeApi.placeOrder(crop.id, amount);
    qc.invalidateQueries({ queryKey: ["crops"] }); qc.invalidateQueries({ queryKey: ["orders"] });
    return "Order placed! The grower will confirm it soon.";
  }); };
  return (
    <Sheet title="Place order" onClose={onClose}>
      {done ? <Done message={done} onClose={onClose} secondary={{ label: "See my orders", onClick: onViewOrders }} /> : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="pr-8 text-2xl font-bold">Order {crop.crop_name}</h2>
          <p className="text-sm text-slate-600">₹{crop.price_per_kg} per kg · {crop.quantity_remaining} {crop.unit} available · {crop.location}</p>
          <Field name={`Quantity (${crop.unit})`}>
            <input className={input} type="number" min="0.1" step="any" max={crop.quantity_remaining} required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <p className="flex justify-between rounded-xl bg-[#f1f6ec] px-4 py-3 font-semibold"><span>Total</span><span>₹{(amount * crop.price_per_kg).toLocaleString("en-IN")}</span></p>
          <FormError message={error} />
          <Submit busy={busy}>Confirm order</Submit>
        </form>
      )}
    </Sheet>
  );
}

/* --------------------------------------------------------------- Book */
type Bookable = { kind: "machine"; listing: MachineListing } | { kind: "storage"; listing: StorageListing };

export function BookSheet({ target, onClose, onViewOrders }: { target: Bookable; onClose: () => void; onViewOrders: () => void }) {
  const { ensureRole } = useAuth();
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const { busy, error, done, run } = useAction();
  const title = target.kind === "machine" ? target.listing.machine_type : target.listing.storage_type;
  const refId = target.listing.listing_id;
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    await ensureRole("buyer");
    await tradeApi.book(target.kind, refId, new Date(start).toISOString().slice(0, 19), new Date(end).toISOString().slice(0, 19));
    qc.invalidateQueries({ queryKey: [target.kind === "machine" ? "machines" : "storage"] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
    return "Booking requested! The owner will confirm it.";
  }); };
  const price = target.kind === "machine" ? `₹${target.listing.price_per_unit} ${target.listing.pricing_unit}` : `₹${target.listing.price} ${target.listing.pricing_unit}`;
  return (
    <Sheet title="Book" onClose={onClose}>
      {done ? <Done message={done} onClose={onClose} secondary={{ label: "See my bookings", onClick: onViewOrders }} /> : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="pr-8 text-2xl font-bold">Book {title}</h2>
          <p className="text-sm text-slate-600">{price} · {target.listing.location}. The final price is calculated from your dates.</p>
          <Field name="From"><input className={input} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field name="Until"><input className={input} type="datetime-local" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <FormError message={error} />
          <Submit busy={busy}>Request booking</Submit>
        </form>
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------- Post */
export type PostKind = ListingKind;
const POST_KINDS: { kind: PostKind; label: string }[] = [
  { kind: "crop", label: "Crop" },
  { kind: "machine", label: "Machinery" },
  { kind: "storage", label: "Storage" },
];

export function PostSheet({ initial, onClose }: { initial: PostKind; onClose: () => void }) {
  const [kind, setKind] = useState<PostKind>(initial);
  const [done, setDone] = useState("");
  return (
    <Sheet title="Post a listing" onClose={onClose}>
      {done ? <Done message={done} onClose={onClose} /> : (
        <div className="space-y-3">
          <h2 className="pr-8 text-2xl font-bold">Post a listing</h2>
          <div className="grid grid-cols-3 gap-2" role="tablist">
            {POST_KINDS.map(({ kind: k, label: l }) => (
              <button type="button" role="tab" aria-selected={k === kind} key={k} onClick={() => setKind(k)}
                className={`rounded-xl border py-2 text-sm font-semibold ${k === kind ? "border-[#1d5a2b] bg-[#eaf4e5] text-[#1d5a2b]" : "border-[#d8dfce] text-slate-600"}`}>{l}</button>
            ))}
          </div>
          <ListingForm key={kind} kind={kind} onSaved={setDone} />
        </div>
      )}
    </Sheet>
  );
}

export type { Bookable };
