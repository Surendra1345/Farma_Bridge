import { useState, type FormEvent } from "react";
import { CircleUserRound, Loader2 } from "lucide-react";
import { authApi } from "../api";
import { useAuth } from "../auth";
import type { Role } from "../types";
import { FormError, ROLE_OPTIONS } from "./AuthSheet";
import { Field, useAction } from "./formKit";
import { inputClass as input, primaryClass as primary } from "./formStyles";
import { MyListings } from "./MyListings";
import { ActivityList, usePendingRequestCount } from "./Activity";
import { Sheet } from "./Sheet";

export type AccountTab = "profile" | "listings" | "purchases" | "requests";

export function AccountSheet({ tab: initialTab = "profile", onClose, onPost }: { tab?: AccountTab; onClose: () => void; onPost: () => void }) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const pending = usePendingRequestCount();
  if (!user) return null;

  const tabClass = (t: AccountTab) => `rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-[#1d5a2b] text-white" : "bg-[#eaf4e5] text-[#1d5a2b] hover:bg-[#dcebd5]"}`;

  return (
    <Sheet title="Account" onClose={onClose} wide>
      <div className="flex items-center gap-3 pr-10">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e9f3e5] text-[#1d5a2b]"><CircleUserRound /></span>
        <div className="min-w-0"><h2 className="truncate text-xl font-bold">{user.name}</h2><p className="truncate text-sm text-slate-600">{user.email}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        <button role="tab" aria-selected={tab === "profile"} className={tabClass("profile")} onClick={() => setTab("profile")}>Profile</button>
        <button role="tab" aria-selected={tab === "purchases"} className={tabClass("purchases")} onClick={() => setTab("purchases")}>My orders</button>
        <button role="tab" aria-selected={tab === "listings"} className={tabClass("listings")} onClick={() => setTab("listings")}>My listings</button>
        <button role="tab" aria-selected={tab === "requests"} className={tabClass("requests")} onClick={() => setTab("requests")}>
          Requests{pending > 0 && <span className="ml-1.5 rounded-full bg-[#ff962e] px-1.5 py-0.5 text-xs font-bold text-[#1e3a22]">{pending}</span>}
        </button>
      </div>
      <div className="mt-5">
        {tab === "profile" && <ProfileForm onSignOut={() => { signOut(); onClose(); }} />}
        {tab === "purchases" && <ActivityList side="mine" />}
        {tab === "listings" && <MyListings onPost={() => { onClose(); onPost(); }} />}
        {tab === "requests" && <ActivityList side="incoming" />}
      </div>
    </Sheet>
  );
}

function ProfileForm({ onSignOut }: { onSignOut: () => void }) {
  const { user, updateUser, ensureRole } = useAuth();
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState(false);
  const [roleError, setRoleError] = useState("");
  if (!user) return null;

  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); setSaved(false); run(async () => {
    const g = (k: string) => String(f.get(k) ?? "").trim();
    updateUser(await authApi.updateProfile({ name: g("name"), phone_number: g("phone"), address: g("address"), location: g("location") }));
    setSaved(true);
    return "saved";
  }); };

  const addRole = async (role: Role) => { setRoleError(""); try { await ensureRole(role); } catch (e) { setRoleError(e instanceof Error ? e.message : "Couldn't add that."); } };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="Full name"><input name="name" className={input} required defaultValue={user.name} /></Field>
          <Field name="Phone number"><input name="phone" className={input} type="tel" required pattern="[0-9]{10}" title="10-digit phone number" defaultValue={user.phone_number} /></Field>
          <Field name="Address"><input name="address" className={input} required defaultValue={user.address} /></Field>
          <Field name="Village / town"><input name="location" className={input} required defaultValue={user.location} /></Field>
        </div>
        <p className="text-xs text-slate-500">Email ({user.email}) is your sign-in and can't be changed here.</p>
        <FormError message={error} />
        {saved && <p role="status" className="rounded-lg bg-[#eaf4e5] px-3 py-2 text-sm font-semibold text-[#1d5a2b]">Profile saved.</p>}
        <button className={primary} disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Save changes</button>
      </form>

      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-700">What you do on AgriLink</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map(({ role, label, hint }) => {
            const has = user.roles.includes(role);
            return (
              <div key={role} className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${has ? "border-[#1d5a2b] bg-[#eaf4e5]" : "border-[#d8dfce]"}`}>
                <div><p className="text-sm font-bold">{label}</p><p className="text-xs text-slate-500">{hint}</p></div>
                {has ? <span className="text-xs font-bold text-[#1d5a2b]">Active</span>
                  : <button className="rounded-lg border border-[#1d5a2b] px-3 py-1.5 text-xs font-bold text-[#1d5a2b] hover:bg-white" onClick={() => addRole(role)}>Add</button>}
              </div>
            );
          })}
        </div>
        <FormError message={roleError} />
      </section>

      <button className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
