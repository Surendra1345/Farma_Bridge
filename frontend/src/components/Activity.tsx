import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Inbox, MessageCircle, Phone, ShoppingBag, Star } from "lucide-react";
import { mediaUrl, reportApi, reviewApi, tradeApi } from "../api";
import { useAuth } from "../auth";
import type { Booking, Order, Party, PaymentAction, PaymentMethod, PaymentStatus, Review } from "../types";
import { FormError } from "./AuthSheet";
import { PaymentQr } from "./PaymentQr";

/** One row for either an order or a booking, seen from the current user's side. */
type Item = {
  key: string; kind: "order" | "booking"; id: number; status: string; title: string; photo?: string | null;
  label: string; detail: string; total: number; when: string; other?: Party | null; otherRole: string; sortAt: string;
  payment: PaymentStatus; paymentMethod?: string | null;
};

const ACTIVE = new Set(["Pending", "Confirmed"]);
const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800", Confirmed: "bg-[#e3f0de] text-[#1d5a2b]",
  Completed: "bg-slate-100 text-slate-700", Cancelled: "bg-red-50 text-red-700",
};
/** The API stores UTC without a zone suffix ("2026-11-05T07:07:00"); read it as UTC, show local time. */
const asUtc = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
const fmtDate = (iso: string) => asUtc(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** wa.me needs digits only with the country code; the app stores 10-digit Indian numbers. */
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function orderItem(o: Order, mine: boolean): Item {
  return {
    key: `o${o.order_id}`, kind: "order", id: o.order_id, status: o.status, title: o.listing_title ?? `Listing #${o.listing_id}`,
    photo: o.listing_photo, label: "Crop order", detail: `${o.quantity_ordered} ${o.unit ?? "kg"}${o.price_per_unit ? ` × ₹${o.price_per_unit}` : ""}`,
    total: o.total_price, when: `Ordered ${fmtDate(o.ordered_at)}`, other: mine ? o.farmer : o.buyer, otherRole: mine ? "Seller" : "Buyer", sortAt: o.ordered_at,
    payment: o.payment_status, paymentMethod: o.payment_method,
  };
}
function bookingItem(b: Booking, mine: boolean): Item {
  return {
    key: `b${b.booking_id}`, kind: "booking", id: b.booking_id, status: b.status, title: b.listing_title ?? `Listing #${b.reference_id}`,
    photo: b.listing_photo, label: b.booking_type === "machine" ? "Machinery booking" : "Storage booking",
    detail: `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`, total: b.total_price, when: `Requested ${fmtDate(b.created_at)}`,
    other: mine ? b.provider : b.requester, otherRole: mine ? "Owner" : "Booked by", sortAt: b.created_at,
    payment: b.payment_status, paymentMethod: b.payment_method,
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

const METHODS: PaymentMethod[] = ["UPI", "Cash", "Bank transfer", "Other"];

/** Payments happen outside the app (UPI/cash/bank). Here the payer says "I paid" and the receiver confirms. */
function PaymentBox({ item, side }: { item: Item; side: "mine" | "incoming" }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (item.status !== "Confirmed" && item.status !== "Completed") return null;
  const payer = side === "mine";
  const run = async (action: PaymentAction) => {
    setBusy(true); setError("");
    try {
      if (item.kind === "order") await tradeApi.setOrderPayment(item.id, action, method);
      else await tradeApi.setBookingPayment(item.id, action, method);
      await Promise.all([qc.invalidateQueries({ queryKey: ["orders"] }), qc.invalidateQueries({ queryKey: ["bookings"] })]);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the payment."); }
    finally { setBusy(false); }
  };
  const btn = "rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-60";
  const picker = (
    <select aria-label="How was it paid" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
      {METHODS.map((m) => <option key={m}>{m}</option>)}
    </select>
  );
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-semibold">
        {item.payment === "Received" ? <span className="text-[#1d5a2b]">✓ Payment received{item.paymentMethod ? ` (${item.paymentMethod})` : ""}</span>
          : item.payment === "Marked Paid" ? <span className="text-amber-800">Paid via {item.paymentMethod} - waiting for {payer ? "the seller" : "you"} to confirm</span>
          : <span className="text-slate-700">Payment pending · {money(item.total)} <span className="font-normal text-slate-500">(pay by UPI, cash or bank transfer; the app doesn't handle money)</span></span>}
      </p>
      {payer && item.payment !== "Received" && item.other?.upi_id && (
        <PaymentQr upiId={item.other.upi_id} payee={item.other.name} amount={item.total} note={`${item.label} #${item.id}`} />
      )}
      {payer && item.payment === "Unpaid" && !item.other?.upi_id && (
        <p className="mt-1 text-xs text-slate-500">{item.other?.name ?? "The seller"} hasn't added a UPI id. Ask them on WhatsApp or call, or pay in cash.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {payer && item.payment === "Unpaid" && <>{picker}<button disabled={busy} className={`${btn} bg-[#1d5a2b] text-white`} onClick={() => run("paid")}>I've paid</button></>}
        {payer && item.payment === "Marked Paid" && <button disabled={busy} className={`${btn} border border-slate-300`} onClick={() => run("undo")}>Undo</button>}
        {!payer && item.payment === "Unpaid" && <>{picker}<button disabled={busy} className={`${btn} bg-[#1d5a2b] text-white`} onClick={() => run("received")}>Payment received</button></>}
        {!payer && item.payment === "Marked Paid" && <><button disabled={busy} className={`${btn} bg-[#1d5a2b] text-white`} onClick={() => run("received")}>Confirm received</button><button disabled={busy} className={`${btn} border border-red-200 text-red-700`} onClick={() => run("not_received")}>Not received</button></>}
        {!payer && item.payment === "Received" && <button disabled={busy} className={`${btn} border border-slate-300`} onClick={() => run("not_received")}>Undo</button>}
      </div>
      <FormError message={error} />
    </div>
  );
}

/** After a deal is Completed, each person can rate the other once, and change or delete it for 7 days. */
function ReviewBox({ item, review }: { item: Item; review?: Review }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (item.status !== "Completed" || !item.other) return null;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["my-reviews", user?.id] }), qc.invalidateQueries({ queryKey: ["orders"] }), qc.invalidateQueries({ queryKey: ["bookings"] })]);
  const editable = !review || Date.now() - new Date(/[zZ]|[+-]\d\d:\d\d$/.test(review.created_at) ? review.created_at : `${review.created_at}Z`).getTime() < 7 * 86_400_000;
  if (review && !open) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1d5a2b]">
        <span>✓ You rated {item.other.name} {"★".repeat(review.rating)}</span>
        {editable && <>
          <button className="underline" onClick={() => { setRating(review.rating); setComment(review.comment ?? ""); setOpen(true); }}>Edit</button>
          <button className="text-red-700 underline" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await reviewApi.remove(review.review_id); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete."); } finally { setBusy(false); } }}>Delete</button>
        </>}
        <FormError message={error} />
      </p>
    );
  }
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-800"><Star size={14} />Rate {item.other.name}</button>;
  const submit = async () => {
    if (!rating) { setError("Pick 1 to 5 stars."); return; }
    setBusy(true); setError("");
    try {
      if (review) await reviewApi.update(review.review_id, { rating, comment: comment.trim() || null });
      else await reviewApi.create({ reviewed_user_id: item.other!.id, rating, comment: comment.trim() || undefined, context_type: item.kind, context_id: item.id });
      await refresh(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save your review."); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 rounded-xl bg-amber-50 p-3">
      <p className="text-sm font-semibold">{review ? "Change your review of" : "How was it with"} {item.other.name}?</p>
      <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
            <Star size={26} className={n <= rating ? "fill-amber-400 text-amber-500" : "text-slate-300"} />
          </button>
        ))}
      </div>
      <textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder="Optional: what went well or badly?" rows={2}
        className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm" />
      <FormError message={error} />
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold" onClick={() => setOpen(false)}>{review ? "Cancel" : "Not now"}</button>
        <button disabled={busy} className="rounded-lg bg-[#1d5a2b] px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60" onClick={submit}>{busy ? "Saving…" : review ? "Save changes" : "Submit review"}</button>
      </div>
    </div>
  );
}

const REPORT_REASONS = ["No-show / didn't deliver", "Wrong or misleading listing", "Rude or abusive", "Suspected fraud", "Other"];

/** Anyone in a deal can report the other person to the admins. */
function ReportUser({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!item.other) return null;
  if (sent) return <p className="mt-2 text-xs font-semibold text-slate-500">Report sent to the admins. Thank you.</p>;
  if (!open) return <button className="mt-2 block text-xs font-semibold text-slate-500 underline hover:text-red-700" onClick={() => setOpen(true)}>Report {item.other.name}</button>;
  const submit = async () => {
    setBusy(true); setError("");
    try { await reportApi.create({ reported_user_id: item.other!.id, reason, description: text.trim() || undefined }); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't send the report."); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
      <p className="font-semibold text-red-800">Report {item.other.name}</p>
      <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5">
        {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="What happened? (optional)" rows={2} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2" />
      <FormError message={error} />
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold" onClick={() => setOpen(false)}>Cancel</button>
        <button disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60" onClick={submit}>{busy ? "Sending…" : "Send report"}</button>
      </div>
    </div>
  );
}

function useActivity(side: "mine" | "incoming") {
  const { user } = useAuth();
  const orders = useQuery({ queryKey: ["orders", user?.id], queryFn: tradeApi.myOrders, enabled: !!user, refetchInterval: 30_000 });
  const bookings = useQuery({ queryKey: ["bookings", user?.id], queryFn: tradeApi.myBookings, enabled: !!user, refetchInterval: 30_000 });   // new requests show up without a reload
  const uid = user?.id;
  const reviews = useQuery({ queryKey: ["my-reviews", uid], queryFn: () => reviewApi.mine(uid!), enabled: !!user });
  const reviewed = new Map((reviews.data ?? []).map((r) => [`${r.context_type}:${r.context_id}`, r] as const));
  const items: Item[] = [
    ...(orders.data ?? []).filter((o) => (side === "mine" ? o.buyer_id === uid : o.farmer_id === uid)).map((o) => orderItem(o, side === "mine")),
    ...(bookings.data ?? []).filter((b) => (side === "mine" ? b.requester_id === uid : b.provider_id === uid)).map((b) => bookingItem(b, side === "mine")),
  ].sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)) || b.sortAt.localeCompare(a.sortAt));
  return { items, reviewed, loading: orders.isLoading || bookings.isLoading, failed: orders.isError || bookings.isError };
}

/** Number of requests on my listings still waiting for my answer. */
export function usePendingRequestCount() {
  return useActivity("incoming").items.filter((i) => i.status === "Pending").length;
}

export function ActivityList({ side }: { side: "mine" | "incoming" }) {
  const qc = useQueryClient();
  const { items, reviewed, loading, failed } = useActivity(side);
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
                      {item.otherRole}: <b>{item.other.name}</b>{item.other.trust_score ? <span className="ml-1 text-amber-700" title="Average rating">★ {item.other.trust_score.toFixed(1)}</span> : null} · {item.other.location}
                    </p>
                  )}
                  {item.other?.phone_number && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <a href={`tel:${item.other.phone_number}`} className="inline-flex items-center gap-1 rounded-lg border border-[#1d5a2b] px-2.5 py-1 font-semibold text-[#1d5a2b]"><Phone size={13} />Call {item.other.phone_number}</a>
                      <a href={`https://wa.me/${waNumber(item.other.phone_number)}?text=${encodeURIComponent(`Hi ${item.other.name}, about your ${item.title} on Farma Bridge (${item.label.toLowerCase()}, ${item.status}).`)}`}
                        target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1 font-semibold text-white"><MessageCircle size={13} />WhatsApp</a>
                      {item.status === "Pending" && <span className="text-xs text-slate-500">Talk first, then {side === "incoming" ? "accept" : "wait for acceptance"}.</span>}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{item.when}</p>
                </div>
              </div>
              <PaymentBox item={item} side={side} />
              <ReviewBox item={item} review={reviewed.get(`${item.kind}:${item.id}`)} />
              <ReportUser item={item} />
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
