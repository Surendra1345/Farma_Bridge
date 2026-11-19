import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Smartphone } from "lucide-react";

/** A UPI payment QR for exactly this amount. Scan it with any UPI app (GPay, PhonePe, Paytm...). Nothing is sent to our servers. */
export function PaymentQr({ upiId, payee, amount, note }: { upiId: string; payee: string; amount: number; note: string }) {
  const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note.slice(0, 40))}`;
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: 220, errorCorrectionLevel: "M" }).then((url) => { if (alive) setSrc(url); }).catch(() => { if (alive) setSrc(""); });
    return () => { alive = false; };
  }, [link]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the id is shown anyway */ }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
      {src ? <img src={src} alt={`UPI QR code to pay ${payee} ₹${amount}`} width={132} height={132} className="size-[132px] rounded-lg" /> : <div className="size-[132px] rounded-lg bg-slate-100" />}
      <div className="min-w-0 text-sm">
        <p className="font-semibold">Scan to pay ₹{amount.toLocaleString("en-IN")}</p>
        <p className="mt-0.5 text-slate-600">to {payee}</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-700">{upiId}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy UPI id"}</button>
          <a href={link} className="inline-flex items-center gap-1 rounded-lg bg-[#1d5a2b] px-2.5 py-1 text-xs font-semibold text-white md:hidden"><Smartphone size={13} />Open UPI app</a>
        </div>
        <p className="mt-2 text-xs text-slate-500">After paying, tap "I've paid" below.</p>
      </div>
    </div>
  );
}
