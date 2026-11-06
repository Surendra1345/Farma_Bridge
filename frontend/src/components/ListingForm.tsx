import { type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tradeApi } from "../api";
import { useAuth } from "../auth";
import { CROP_CATEGORIES } from "../sections";
import type { CropListing, MachineListing, Role, StorageListing } from "../types";
import { FormError } from "./AuthSheet";
import { Field, Submit, useAction } from "./formKit";
import { inputClass as input } from "./formStyles";

export type ListingKind = "crop" | "machine" | "storage";
export type Existing = CropListing | MachineListing | StorageListing;

export const ROLE_FOR_KIND: Record<ListingKind, Role> = { crop: "farmer", machine: "machine_owner", storage: "storage_owner" };
const QUERY_KEY: Record<ListingKind, string> = { crop: "crops", machine: "machines", storage: "storage" };
const PHOTO = "block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#eaf4e5] file:px-4 file:py-2 file:font-semibold file:text-[#1d5a2b]";

/** One form for creating a listing and for editing one (pass `existing`). */
export function ListingForm({ kind, existing, onSaved }: { kind: ListingKind; existing?: Existing; onSaved: (message: string) => void }) {
  const { user, ensureRole } = useAuth();
  const qc = useQueryClient();
  const { busy, error, run } = useAction();
  const editing = !!existing;
  const crop = existing as CropListing | undefined;
  const machine = existing as MachineListing | undefined;
  const storage = existing as StorageListing | undefined;

  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(async () => {
    const photo = f.get("photo") as File;
    const hasPhoto = !!photo && photo.size > 0;
    if (!editing && !hasPhoto) throw new Error("Please add a photo.");
    const g = (k: string) => String(f.get(k) ?? "").trim();
    const photoField = hasPhoto ? photo : undefined;

    if (kind === "crop") {
      const base = { crop_name: g("name"), category: g("category"), quantity: g("quantity"), unit: "kg", price_per_kg: g("price"), quality_grade: g("grade"), location: g("location") };
      if (editing) await tradeApi.updateCrop(crop!.id, { ...base, status: crop!.status, post_cultivation_photo: photoField });
      else { await ensureRole(ROLE_FOR_KIND.crop); await tradeApi.postCrop({ ...base, post_cultivation_photo: photoField }); }
    } else if (kind === "machine") {
      const base = { machine_type: g("name"), pricing_unit: g("unit"), price_per_unit: g("price"), location: g("location") };
      if (editing) await tradeApi.updateMachine(machine!.listing_id, { ...base, status: machine!.status, machine_photo: photoField });
      else { await ensureRole(ROLE_FOR_KIND.machine); await tradeApi.postMachine({ ...base, machine_photo: photoField }); }
    } else {
      const base = { storage_type: g("name"), total_capacity: g("capacity"), pricing_unit: g("unit"), price: g("price"), location: g("location") };
      if (editing) await tradeApi.updateStorage(storage!.listing_id, { ...base, storage_photo: photoField });
      else { await ensureRole(ROLE_FOR_KIND.storage); await tradeApi.postStorage({ ...base, storage_photo: photoField }); }
    }
    qc.invalidateQueries({ queryKey: [QUERY_KEY[kind]] });
    const message = editing ? "Listing updated." : "Your listing is live!";
    onSaved(message);
    return message;
  }); };

  return (
    <form onSubmit={submit} className="space-y-3">
      {kind === "crop" && <>
        <Field name="Crop name"><input name="name" className={input} required placeholder="e.g. Tomato" defaultValue={crop?.crop_name} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="Category"><select name="category" className={input} defaultValue={crop?.category}>{CROP_CATEGORIES.filter((c) => c !== "All").concat("Other").map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field name="Grade (optional)"><input name="grade" className={input} placeholder="A" defaultValue={crop?.quality_grade ?? ""} /></Field>
          <Field name="Total quantity (kg)"><input name="quantity" className={input} type="number" min="1" step="any" required defaultValue={crop?.quantity} /></Field>
          <Field name="Price per kg (₹)"><input name="price" className={input} type="number" min="1" required defaultValue={crop?.price_per_kg} /></Field>
        </div>
      </>}
      {kind === "machine" && <>
        <Field name="Machine type"><input name="name" className={input} required placeholder="e.g. Tractor" defaultValue={machine?.machine_type} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="Charged"><select name="unit" className={input} defaultValue={machine?.pricing_unit}><option>Per Hour</option><option>Per Acre</option></select></Field>
          <Field name="Price (₹)"><input name="price" className={input} type="number" min="1" required defaultValue={machine?.price_per_unit} /></Field>
        </div>
      </>}
      {kind === "storage" && <>
        <Field name="Storage type"><input name="name" className={input} required placeholder="e.g. Cold room" defaultValue={storage?.storage_type} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="Capacity"><input name="capacity" className={input} type="number" min="1" step="any" required defaultValue={storage?.total_capacity} /></Field>
          <Field name="Charged"><select name="unit" className={input} defaultValue={storage?.pricing_unit}><option>Per Day</option><option>Per Week</option><option>Per Month</option></select></Field>
          <Field name="Price (₹)"><input name="price" className={input} type="number" min="1" required defaultValue={storage?.price} /></Field>
        </div>
      </>}

      <Field name="Location"><input name="location" className={input} required defaultValue={existing ? (crop?.location ?? machine?.location ?? storage?.location) : user?.location} /></Field>
      <Field name={editing ? "Replace photo (optional)" : "Photo"}>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} className={PHOTO} />
      </Field>
      <FormError message={error} />
      <Submit busy={busy}>{editing ? "Save changes" : "Publish listing"}</Submit>
    </form>
  );
}
