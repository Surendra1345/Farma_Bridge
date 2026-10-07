import { useState } from "react";
import { Check, KeyRound, Leaf, Loader2, Sparkles, UserCheck, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { registerUser, loginUser, loginWithCredentials, sendOtp, verifyOtp } = useAuth();
  const [tab, setTab] = useState<"register" | "signin" | "otp">("signin");
  const [signInMode, setSignInMode] = useState<"password" | "otp">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("farmer");
  const [otpCode, setOtpCode] = useState("");
  const [lookupId, setLookupId] = useState("");

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      setError("Please provide both email/phone and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithCredentials(loginIdentifier, loginPassword);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtpSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your registered email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const msg = await sendOtp(email);
      setInfo(msg || `6-digit OTP dispatched to ${email}`);
      setTab("otp");
    } catch (err: any) {
      setError(err.message || "Could not dispatch OTP. Please check the email.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerUser({
        name,
        phone_number: phone,
        email,
        password,
        address,
        location,
        role,
      });
      setInfo(`Account created! A 6-digit OTP has been dispatched to ${email}.`);
      setTab("otp");
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, otpCode);
      setInfo("OTP successfully verified! You're logged in.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      setError("Please provide your email address first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const msg = await sendOtp(email);
      setInfo(msg);
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleDirectUserSelect = async (id: number) => {
    setError(null);
    setLoading(true);
    try {
      const targetUser = await api.users.get(id);
      await loginUser(targetUser);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || `User ID #${id} not found.`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = parseInt(lookupId, 10);
    if (isNaN(id)) {
      setError("Please enter a valid numeric User ID.");
      return;
    }
    await handleDirectUserSelect(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-y-auto max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#e6f2e2] text-[#1d5a2b]">
            <Leaf className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">AgriLink Account</h2>
            <p className="text-xs text-slate-500">FastAPI & PostgreSQL backed authentication</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(null); setInfo(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              tab === "signin" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sign In / Quick Access
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); setInfo(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              tab === "register" || tab === "otp" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error & Info Banners */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
            {info}
          </div>
        )}

        {/* TAB 1: SIGN IN */}
        {tab === "signin" && (
          <div className="mt-5 space-y-5">
            {/* Mode Selector */}
            <div className="flex gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setSignInMode("password")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                  signInMode === "password"
                    ? "bg-[#1d5a2b] text-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                }`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => setSignInMode("otp")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                  signInMode === "otp"
                    ? "bg-[#1d5a2b] text-white"
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                }`}
              >
                Sign In with OTP
              </button>
            </div>

            {signInMode === "password" ? (
              <form onSubmit={handleCredentialsSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. surendrareddy49175@gmail.com or 9876543210"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In to Account"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestOtpSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your registered email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  We'll dispatch a secure 6-digit one-time passcode to your email.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Send Login OTP"}
                </button>
              </form>
            )}

            {/* Quick Access to Active DB Profiles */}
            <div className="relative border-t border-slate-200 pt-4">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quick Switch to Existing Accounts
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleDirectUserSelect(1)}
                  disabled={loading}
                  className="p-3 text-left border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl transition text-xs font-medium text-slate-800"
                >
                  <p className="font-bold text-emerald-800 flex items-center gap-1">
                    🌾 Surendra (#1)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Farmer & Storage Owner</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectUserSelect(2)}
                  disabled={loading}
                  className="p-3 text-left border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl transition text-xs font-medium text-slate-800"
                >
                  <p className="font-bold text-blue-800 flex items-center gap-1">
                    🚜 Manoj (#2)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Machinery Fleet Owner</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectUserSelect(3)}
                  disabled={loading}
                  className="p-3 text-left border border-slate-200 hover:border-[#ff962e] hover:bg-amber-50/50 rounded-xl transition text-xs font-medium text-slate-800"
                >
                  <p className="font-bold text-amber-800 flex items-center gap-1">
                    🛒 Mohan (#3)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Agricultural Buyer</p>
                </button>
              </div>

              {/* Custom Numeric ID option */}
              <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                <form onSubmit={handleQuickSignIn} className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Enter any other User ID"
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#1d5a2b]"
                  />
                  <button
                    type="submit"
                    disabled={loading || !lookupId}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 disabled:opacity-40 shrink-0"
                  >
                    Load ID
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                placeholder="Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@farm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Primary Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="farmer">Farmer (Sell produce)</option>
                  <option value="buyer">Buyer / Trader</option>
                  <option value="machine_owner">Machinery Owner</option>
                  <option value="storage_owner">Storage Owner</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Village / Address</label>
                <input
                  type="text"
                  required
                  placeholder="Main Road, Plot 14"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">District / City</label>
                <input
                  type="text"
                  required
                  placeholder="Guntur, AP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Complete Registration"}
            </button>
          </form>
        )}

        {/* TAB 3: OTP VERIFICATION */}
        {tab === "otp" && (
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <KeyRound className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Email Verification OTP</p>
                <p className="mt-1">
                  Enter the 6-digit verification code sent to <strong>{email}</strong>.
                  (Check your server console log if running in local simulation mode).
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">6-Digit Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="mt-1 w-full text-center tracking-[0.4em] font-mono text-2xl font-bold px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> Verify & Continue</>}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading}
              className="w-full text-center text-xs font-semibold text-[#1d5a2b] hover:underline"
            >
              Didn't receive code? Resend OTP
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
