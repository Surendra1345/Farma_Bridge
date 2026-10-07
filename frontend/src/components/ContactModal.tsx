import { useState, useEffect } from "react";
import { Check, Copy, ExternalLink, Loader2, Mail, MapPin, MessageSquare, Phone, ShieldCheck, X } from "lucide-react";
import { api } from "../api";
import type { User } from "../types";

export function ContactModal({
  userId,
  title,
  subtitle,
  onClose,
}: {
  userId: number;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const [seller, setSeller] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadSeller() {
      setLoading(true);
      try {
        const u = await api.users.get(userId);
        setSeller(u);
      } catch (err: any) {
        setError(err.message || "Failed to load seller contact information.");
      } finally {
        setLoading(false);
      }
    }
    loadSeller();
  }, [userId]);

  const handleCopyPhone = () => {
    if (seller?.phone_number) {
      navigator.clipboard.writeText(seller.phone_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cleanPhone = seller?.phone_number ? seller.phone_number.replace(/\D/g, "") : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-[#1d5a2b]">
            <Phone className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">Contact Grower / Provider</h3>
            <p className="text-xs text-slate-500">{title}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="size-6 animate-spin text-[#1d5a2b]" />
            <p className="text-xs">Fetching verified grower details...</p>
          </div>
        ) : error ? (
          <div className="mt-6 p-4 rounded-2xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {error}
          </div>
        ) : seller ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>{seller.name}</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="size-3" /> Verified
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400 shrink-0" />
                    <span>{seller.location || seller.address || "Local Trading Zone"}</span>
                  </p>
                </div>
              </div>

              {subtitle && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                  <span className="font-medium">Listing:</span> {subtitle}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-[#1d5a2b]" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Direct Phone Line</p>
                    <p className="font-bold text-slate-900 text-sm tracking-wide">{seller.phone_number}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-600"
                  title="Copy Phone Number"
                >
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <Mail className="size-5 text-slate-500" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Email Address</p>
                    <p className="font-bold text-slate-900 text-xs">{seller.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call / WhatsApp Actions */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <a
                href={`tel:${cleanPhone}`}
                className="py-3 px-4 rounded-xl bg-[#1d5a2b] text-white font-bold text-xs hover:bg-[#154620] transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Phone className="size-4" />
                <span>Call Now</span>
              </a>
              <a
                href={`https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=Hello%20${encodeURIComponent(seller.name)},%20I%20am%20interested%20in%20your%20listing%20on%20AgriLink`}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageSquare className="size-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
