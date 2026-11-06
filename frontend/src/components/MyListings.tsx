import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { marketplaceApi, mediaUrl, tradeApi } from "../api";
import { useAuth } from "../auth";
import type { CropListing, MachineListing, StorageListing } from "../types";
import { FormError } from "./AuthSheet";
import { ListingForm, type Existing, type ListingKind } from "./ListingForm";

type Row = {
  kind: ListingKind; id: number; item: Existing; title: string; detail: string; location: string;
  photo?: string | null; status: string; statuses: string[];
};

const STATUS_OPTIONS = {
  crop: ["Available", "Partially Sold", "Sold"],
  machine: ["Available", "Booked"],
  storage: ["Plenty of Space", "Limited Space", "Full"],
};
const KIND_LABEL: Record<ListingKind, string> = { crop: "Crops", machine: "Machinery", storage: "Storage" };
const QUERY_KEY: Record<ListingKind, string> = { crop: "crops", machine: "machines", storage: "storage" };

const cropRow = (c: CropListing): Row => ({ kind: "crop", id: c.id, item: c, title: c.crop_name, detail: `₹${c.price_per_kg}/kg · ${c.quantity_remaining} of ${c.quantity} ${c.unit} left`, location: c.location, photo: c.post_cultivation_photo, status: c.status, statuses: STATUS_OPTIONS.crop });
const machineRow = (m: MachineListing): Row => ({ kind: "machine", id: m.listing_id, item: m, title: m.machine_type, detail: `₹${m.price_per_unit} ${m.pricing_unit}`, location: m.location, photo: m.machine_photos, status: m.status, statuses: STATUS_OPTIONS.machine });
const storageRow = (s: StorageListing): Row => ({ kind: "storage", id: s.listing_id, item: s, title: s.storage_type, detail: `₹${s.price} ${s.pricing_unit} · capacity ${s.total_capacity}`, location: s.location, photo: s.storage_photo, status: s.availability_indicator, statuses: STATUS_OPTIONS.storage });

export function MyListings({ onPost }: { onPost: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ["crops"], queryFn: marketplaceApi.crops });
  const machines = useQuery({ queryKey: ["machines"], queryFn: marketplaceApi.machines });
  const storage = useQuery({ queryKey: ["storage"], queryFn: marketplaceApi.storage });
  const [editing, setEditing] = useState<Row | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  const rows: Row[] = [
    ...(crops.data ?? []).filter((c) => c.user_id === user?.id).map(cropRow),
    ...(machines.data ?? []).filter((m) => m.owner_id === user?.id).map(machineRow),
    ...(storage.data ?? []).filter((s) => s.owner_id === user?.id).map(storageRow),
  ];

  const act = async (fn: () => Promise<unknown>, kind: ListingKind, message: string) => {
    setError(""); setFlash("");
    try { await fn(); await qc.invalidateQueries({ queryKey: [QUERY_KEY[kind]] }); setFlash(message); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  };

  const changeStatus = (r: Row, value: string) => act(() =>
    r.kind === "crop" ? tradeApi.setCropStatus(r.id, value) : r.kind === "machine" ? tradeApi.setMachineStatus(r.id, value) : tradeApi.setStorageStatus(r.id, value),
    r.kind, "Status updated.");
  const remove = (r: Row) => act(() => tradeApi.remove(r.kind, r.id), r.kind, "Listing deleted.").then(() => setConfirming(null));

  if (editing) {
    return (
      <div className="space-y-3">
        <button className="flex items-center gap-1 text-sm font-semibold text-slate-500" onClick={() => setEditing(null)}><ArrowLeft size={16} /> Back to my listings</button>
        <h3 className="text-xl font-bold">Edit {editing.title}</h3>
        <ListingForm kind={editing.kind} existing={editing.item} onSaved={() => { setEditing(null); setFlash("Listing updated."); }} />
      </div>
    );
  }

  if (crops.isLoading || machines.isLoading || storage.isLoading) return <p className="py-8 text-center text-slate-500">Loading your listings…</p>;

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf5e9] text-[#266330]"><PackagePlus /></span>
        <p className="mt-3 font-semibold">You haven't posted anything yet</p>
        <p className="mt-1 text-sm text-slate-500">Crops, machinery and storage you post will show up here.</p>
        <button className="mt-4 rounded-xl bg-[#1d5a2b] px-5 py-2.5 text-sm font-bold text-white" onClick={onPost}>Post a listing</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {flash && <p role="status" className="rounded-lg bg-[#eaf4e5] px-3 py-2 text-sm font-semibold text-[#1d5a2b]">{flash}</p>}
      <FormError message={error} />
      {(["crop", "machine", "storage"] as ListingKind[]).map((kind) => {
        const group = rows.filter((r) => r.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} aria-label={KIND_LABEL[kind]}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#d8731c]">{KIND_LABEL[kind]} ({group.length})</h3>
            <ul className="space-y-3">
              {group.map((r) => {
                const key = `${r.kind}-${r.id}`;
                const src = mediaUrl(r.photo);
                return (
                  <li key={key} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#e3efd5]">{src && <img src={src} alt="" className="size-full object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{r.title}</p>
                      <p className="truncate text-sm text-slate-600">{r.detail}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{r.location}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select aria-label={`Status of ${r.title}`} value={r.status} onChange={(e) => changeStatus(r, e.target.value)}
                          className="rounded-lg border border-[#d8dfce] bg-white px-2 py-1.5 text-xs font-semibold">
                          {r.statuses.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <button className="flex items-center gap-1 rounded-lg border border-[#d8dfce] px-3 py-1.5 text-xs font-semibold hover:bg-[#eaf4e5]" onClick={() => { setEditing(r); setFlash(""); }}>
                          <Pencil size={13} /> Edit
                        </button>
                        {confirming === key ? (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="font-semibold text-red-700">Delete?</span>
                            <button className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white" onClick={() => remove(r)}>Yes, delete</button>
                            <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold" onClick={() => setConfirming(null)}>Keep</button>
                          </span>
                        ) : (
                          <button className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => setConfirming(key)}>
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
