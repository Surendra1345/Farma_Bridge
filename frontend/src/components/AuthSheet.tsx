import { useState, type FormEvent } from "react";
import { ArrowLeft, Leaf, Loader2 } from "lucide-react";
import { ApiError, authApi } from "../api";
import { useAuth } from "../auth";
import type { Role } from "../types";
import { inputClass as input, primaryClass as primary } from "./formStyles";
import { Sheet } from "./Sheet";

type Step = "email" | "register" | "otp";

export const ROLE_OPTIONS: { role: Role; label: string; hint: string }[] = [
  { role: "farmer", label: "Farmer", hint: "Sell my crops" },
  { role: "buyer", label: "Buyer", hint: "Buy produce" },
  { role: "machine_owner", label: "Machinery owner", hint: "Rent out equipment" },
  { role: "storage_owner", label: "Storage owner", hint: "Offer storage space" },
];

/** `onClose` = dismissed without signing in; `onSuccess` = signed in. */
export function AuthSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({ name: "", phone_number: "", address: "", location: "" });
  const [roles, setRoles] = useState<Role[]>(["buyer"]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };

  const toggleRole = (role: Role) => setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));

  const submitEmail = (e: FormEvent) => { e.preventDefault(); run(async () => {
    try { await authApi.sendOtp(email.trim()); setStep("otp"); }
    catch (err) { if (err instanceof ApiError && err.status === 404) setStep("register"); else throw err; }
  }); };

  const submitRegister = (e: FormEvent) => { e.preventDefault(); run(async () => {
    if (roles.length === 0) throw new Error("Pick at least one option so we know what you'd like to do.");
    await authApi.register({ ...form, email: email.trim(), roles }); setStep("otp");
  }); };

  const submitOtp = (e: FormEvent) => { e.preventDefault(); run(async () => {
    const { access_token, user } = await authApi.verifyOtp(email.trim(), otp.trim());
    signIn(access_token, user); onSuccess();
  }); };

  const resend = () => run(async () => { await authApi.sendOtp(email.trim()); setNotice("A new code is on its way."); });

  const text = (key: keyof typeof form, label: string) => (
    <input className={input} required placeholder={label} aria-label={label} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
  );

  return (
    <Sheet title="Sign in" onClose={onClose}>
      {step !== "email" && (
        <button className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500" onClick={() => { setStep("email"); setError(""); }}>
          <ArrowLeft size={16} /> Back
        </button>
      )}
      <span className="grid size-12 place-items-center rounded-2xl bg-[#e9f3e5] text-[#1d5a2b]"><Leaf /></span>

      {step === "email" && (
        <form onSubmit={submitEmail} className="space-y-4">
          <h2 className="mt-4 text-2xl font-bold">Sign in to continue</h2>
          <p className="text-sm leading-6 text-slate-600">Enter your email and we'll send you a one-time code.</p>
          <input className={input} type="email" required autoFocus placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <button className={primary} disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Continue with email</button>
          <p className="text-center text-sm text-slate-500">New to AgriLink?{" "}
            <button type="button" className="font-semibold text-[#1d5a2b] underline" onClick={() => { setStep("register"); setError(""); }}>Create an account</button>
          </p>
        </form>
      )}

      {step === "register" && (
        <form onSubmit={submitRegister} className="space-y-3">
          <h2 className="mt-4 text-2xl font-bold">Create your account</h2>
          <p className="text-sm text-slate-600">Tell us a bit about you. We'll email a code to verify your address.</p>
          <input className={input} type="email" required placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {text("name", "Full name")}
          <input className={input} type="tel" required placeholder="Phone number (10 digits)" aria-label="Phone number" pattern="[0-9]{10}" title="Enter a 10-digit phone number"
            value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
          {text("address", "Address")}
          {text("location", "Village / town")}

          <fieldset className="pt-1">
            <legend className="mb-2 text-sm font-semibold text-slate-700">What would you like to do?</legend>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(({ role, label, hint }) => {
                const on = roles.includes(role);
                return (
                  <button type="button" key={role} aria-pressed={on} onClick={() => toggleRole(role)}
                    className={`rounded-xl border p-3 text-left transition ${on ? "border-[#1d5a2b] bg-[#eaf4e5]" : "border-[#d8dfce] bg-white hover:border-[#1d5a2b]"}`}>
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <FormError message={error} />
          <button className={primary} disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Create account</button>
          <p className="text-center text-sm text-slate-500">Already have an account?{" "}
            <button type="button" className="font-semibold text-[#1d5a2b] underline" onClick={() => { setStep("email"); setError(""); }}>Sign in</button>
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={submitOtp} className="space-y-4">
          <h2 className="mt-4 text-2xl font-bold">Enter your code</h2>
          <p className="text-sm text-slate-600">We sent a 6-digit code to <b>{email}</b>. It is valid for 5 minutes.</p>
          <input className={`${input} text-center text-2xl tracking-[.5em]`} inputMode="numeric" maxLength={6} pattern="\d{6}" required autoFocus
            aria-label="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          <FormError message={error} />
          {notice && <p className="text-sm text-[#1d5a2b]">{notice}</p>}
          <button className={primary} disabled={busy || otp.length !== 6}>{busy && <Loader2 className="animate-spin" size={18} />}Verify and sign in</button>
          <p className="text-center text-sm text-slate-500">Didn't get it?{" "}
            <button type="button" className="font-semibold text-[#1d5a2b] underline disabled:opacity-50" disabled={busy} onClick={resend}>Resend code</button>
          </p>
        </form>
      )}
    </Sheet>
  );
}

export const FormError = ({ message }: { message: string }) =>
  message ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null;
