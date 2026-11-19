import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { FormError } from "./AuthSheet";

const fmt = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Admin tools (people listed in ADMIN_EMAILS): handle reports and suspend/reinstate users. */
export function AdminPanel() {
  const [view, setView] = useState<"reports" | "users">("reports");
  const tab = (v: typeof view) => `rounded-full px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-[#1d5a2b] text-white" : "bg-slate-100 text-slate-700"}`;
  return (
    <div className="space-y-4">
      <div className="flex gap-2"><button className={tab("reports")} onClick={() => setView("reports")}>Reports</button><button className={tab("users")} onClick={() => setView("users")}>Users</button></div>
      {view === "reports" ? <Reports /> : <Users />}
    </div>
  );
}

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("Open");
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-reports", status], queryFn: () => adminApi.reports(status) });
  const [note, setNote] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const act = async (id: number, s: "Resolved" | "Dismissed") => {
    setBusy(id); setError("");
    try { await adminApi.resolveReport(id, s, (note[id] ?? "").trim() || (s === "Dismissed" ? "No action needed" : "Handled by admin")); await qc.invalidateQueries({ queryKey: ["admin-reports"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the report."); }
    finally { setBusy(null); }
  };
  return (
    <div className="space-y-3">
      <select aria-label="Report status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
        {["Open", "Under Review", "Resolved", "Dismissed"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <FormError message={error} />
      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <FormError message="Couldn't load reports." />}
      {data?.length === 0 && <p className="py-6 text-center text-slate-500">No {status.toLowerCase()} reports.</p>}
      {data?.map((r) => (
        <div key={r.report_id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p><b>{r.reporter_name ?? `User #${r.reporter_id}`}</b> reported <b>{r.reported_user_name ?? `User #${r.reported_user_id}`}</b> · <span className="text-slate-500">{fmt(r.created_at)}</span></p>
          <p className="mt-1 font-semibold">{r.reason}</p>
          {r.description && <p className="mt-0.5 text-slate-600">{r.description}</p>}
          {r.action_taken && <p className="mt-1 text-xs text-slate-500">Action: {r.action_taken}</p>}
          {r.status !== "Resolved" && r.status !== "Dismissed" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input aria-label="Action taken" placeholder="Action taken (optional)" maxLength={200} value={note[r.report_id] ?? ""} onChange={(e) => setNote({ ...note, [r.report_id]: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5" />
              <button disabled={busy === r.report_id} className="rounded-lg bg-[#1d5a2b] px-3 py-1.5 font-bold text-white disabled:opacity-60" onClick={() => act(r.report_id, "Resolved")}>Resolve</button>
              <button disabled={busy === r.report_id} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-60" onClick={() => act(r.report_id, "Dismissed")}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-users", search], queryFn: () => adminApi.users(search) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const toggle = async (id: number, active: boolean) => {
    setBusy(id); setError("");
    try { await adminApi.setActive(id, active); await qc.invalidateQueries({ queryKey: ["admin-users"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't change that user."); }
    finally { setBusy(null); }
  };
  return (
    <div className="space-y-3">
      <input aria-label="Search users" placeholder="Search by name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <FormError message={error} />
      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && <FormError message="Couldn't load users." />}
      <ul className="space-y-2">
        {data?.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold">{u.name} {u.trust_score ? <span className="text-amber-700">★ {u.trust_score.toFixed(1)}</span> : null}</p>
              <p className="truncate text-xs text-slate-500">{u.email} · {u.phone_number} · {u.location}</p>
            </div>
            {u.is_active
              ? <button disabled={busy === u.id} className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 disabled:opacity-60" onClick={() => { if (window.confirm(`Suspend ${u.name}? They will be signed out immediately.`)) toggle(u.id, false); }}>Suspend</button>
              : <button disabled={busy === u.id} className="shrink-0 rounded-lg bg-[#1d5a2b] px-3 py-1.5 font-bold text-white disabled:opacity-60" onClick={() => toggle(u.id, true)}>Reinstate</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
