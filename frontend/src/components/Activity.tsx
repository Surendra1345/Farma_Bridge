import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Inbox, Phone, ShoppingBag } from "lucide-react";
import { mediaUrl, tradeApi } from "../api";
import { useAuth } from "../auth";
import type { Booking, Order, Party } from "../types";
import { FormError } from "./AuthSheet";

/** One row for either an order or a booking, seen from the current user's side. */
type Item = {
  key: string; kind: "order" | "booking"; id: number; status: string; title: string; photo?: string | null;
  label: string; detail: string; total: number; when: string; other?: Party | null; otherRole: string; sortAt: string;
};

const ACTIVE = new Set(["Pending", "Confirmed"]);
const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800", Confirmed: "bg-[#e3f0de] text-[#1d5a2b]",
  Completed: "bg-slate-100 text-slate-700", Cancelled: "bg-red-50 text-red-700",
};
/** The API stores UTC without a zone suffix ("2026-11-05T07:07:00"); read it as UTC, show local time. */
const asUtc = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
const fmtDate = (iso: string) => asUtc(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function orderItem(o: Order, mine: boolean): Item {
  return {
    key: `o${o.order_id}`, kind: "order", id: o.order_id, status: o.status, title: o.listing_title ?? `Listing #${o.listing_id}`,
    photo: o.listing_photo, label: "Crop order", detail: `${o.quantity_ordered} ${o.unit ?? "kg"}${o.price_per_unit ? ` × ₹${o.price_per_unit}` : ""}`,
    total: o.total_price, when: `Ordered ${fmtDate(o.ordered_at)}`, other: mine ? o.farmer : o.buyer, otherRole: mine ? "Seller" : "Buyer", sortAt: o.ordered_at,
  };
}
function bookingItem(b: Booking, mine: boolean): Item {
  return {
    key: `b${b.booking_id}`, kind: "booking", id: b.booking_id, status: b.status, title: b.listing_title ?? `Listing #${b.reference_id}`,
    photo: b.listing_photo, label: b.booking_type === "machine" ? "Machinery booking" : "Storage booking",
    detail: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`, total: b.total_price, when: `Requested ${fmtDate(b.created_at)}`,
    other: mine ? b.provider : b.requester, otherRole: mine ? "Owner" : "Booked by", sortAt: b.created_at,
  };
}

/** Which buttons each side gets, mirroring the server's rules. */
function actionsFor(item: Item, side: "mine" | "incoming"): { label: string; status: string; danger?: boolean }[] {
  if (side === "incoming") {
    if (item.status === "Pending") return [{ label: "Accept", status: "Confirmed" }, { label: "Decline", status: "Cancelled", danger: true }];
    if (item.status === "Confirmed") return [{ label: "Mark completed", status: "Completed" }, { label: "Cancel", status: "Cancelled", danger: true }];
    return [];
  }
  if (item.status === "Pending") return [{ label: item.kind === "order" ? "Cancel order" : "Cancel booking", status: "Cancelled", danger: true }];
  if (item.status === "Confirmed") return [{ label: item.kind === "order" ? "Mark received" : "Mark completed", status: "Completed" }, { label: "Cancel", status: "Cancelled", danger: true }];
  return [];
}

function useActivity(side: "mine" | "incoming") {
  const { user } = useAuth();
  const orders = useQuery({ queryKey: ["orders", user?.id], queryFn: tradeApi.myOrders, enabled: !!user });
  const bookings = useQuery({ queryKey: ["bookings", user?.id], queryFn: tradeApi.myBookings, enabled: !!user });
  const uid = user?.id;
  const items: Item[] = [
    ...(orders.data ?? []).filter((o) => (side === "mine" ? o.buyer_id === uid : o.farmer_id === uid)).map((o) => orderItem(o, side === "mine")),
    ...(bookings.data ?? []).filter((b) => (side === "mine" ? b.requester_id === uid : b.provider_id === uid)).map((b) => bookingItem(b, side === "mine")),
  ].sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) || b.sortAt.localeCompare(a.sortAt));
  return { items, loading: orders.isLoading || bookings.isLoading, failed: orders.isError || bookings.isError };
}

/** Number of requests on my listings still waiting for my answer. */
export function usePendingRequestCount() {
  return useActivity("incoming").items.filter((i) => i.status === "Pending").length;
}

export function ActivityList({ side }: { side: "mine" | "incoming" }) {
  const qc = useQueryClient();
  const { items, loading, failed } = useActivity(side);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const change = async (item: Item, status: string, label: string) => {
    setBusy(item.key); setError(""); setFlash("");
    try {
      if (item.kind === "order") await tradeApi.setOrderStatus(item.id, status);
      else await tradeApi.setBookingStatus(item.id, status);
      // stock / availability may have changed too
      await Promise.all(["orders", "bookings", "crops", "machines", "storage"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setFlash(`${item.title}: ${label.toLowerCase()} ✓`);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(null); setConfirming(null); }
  };

  if (loading) return <p className="py-8 text-center text-slate-500">Loading…</p>;
  if (failed) return <FormError message="Couldn't load your orders and bookings. Try again." />;
  if (items.length === 0) {
    const Icon = side === "mine" ? ShoppingBag : Inbox;
    return (
      <div className="py-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf5e9] text-[#266330]"><Icon /></span>
        <p className="mt-3 font-semibold">{side === "mine" ? "You haven't ordered or booked anything yet" : "No one has ordered or booked your listings yet"}</p>
        <p className="mt-1 text-sm text-slate-500">{side === "mine" ? "Crops you order and machinery or storage you book will appear here." : "When someone orders a crop or books your machinery or storage, you'll accept or decline it here."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flash && <p role="status" className="rounded-lg bg-[#eaf4e5] px-3 py-2 text-sm font-semibold text-[#1d5a2b]">{flash}</p>}
      <FormError message={error} />
      <ul className="space-y-3">
        {items.map((item) => {
          const src = mediaUrl(item.photo);
          const actions = actionsFor(item, side);
          return (
            <li key={item.key} className={`rounded-2xl border bg-white p-3 ${ACTIVE.has(item.status) ? "border-slate-200" : "border-slate-100 opacity-75"}`}>
              <div className="flex gap-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#e3efd5]">{src && <img src={src} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="truncate font-bold">{item.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[item.status] ?? "bg-slate-100"}`}>{item.status}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">{item.kind === "booking" && <CalendarDays size={14} />}{item.detail} · <b>{money(item.total)}</b></p>
                  {item.other && (
                    <p className="mt-1 text-sm text-slate-700">
                      {item.otherRole}: <b>{item.other.name}</b> · {item.other.location}
                      {item.other.phone_number
                        ? <a href={`tel:${item.other.phone_number}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-[#1d5a2b] underline"><Phone size={13} />{item.other.phone_number}</a>
                        : item.status === "Pending" && <span className="ml-1 text-xs text-slate-500">(phone shared once accepted)</span>}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{item.when}</p>
                </div>
              </div>
              {actions.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {actions.map((a) => {
                    const ck = `${item.key}:${a.status}`;
                    if (a.danger && confirming === ck) {
                      return (
                        <span key={ck} className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-red-700">Sure?</span>
                          <button className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60" disabled={busy === item.key} onClick={() => change(item, a.status, a.label)}>Yes, {a.label.toLowerCase()}</button>
                          <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold" onClick={() => setConfirming(null)}>No</button>
                        </span>
                      );
                    }
                    return (
                      <button key={ck} disabled={busy === item.key} onClick={() => (a.danger ? setConfirming(ck) : change(item, a.status, a.label))}
                        className={a.danger
                          ? "rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          : "rounded-lg bg-[#1d5a2b] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#174d24] disabled:opacity-60"}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
