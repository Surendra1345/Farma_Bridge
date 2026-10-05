import { useState } from "react";
import { AlertCircle, Calendar, Clock, Loader2, MapPin, Tractor, Warehouse, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import type { MachineListing, StorageListing } from "../types";

export function BookingModal({
  item,
  type,
  onClose,
  onSuccess,
}: {
  item: MachineListing | StorageListing;
  type: "machine" | "storage";
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = type === "machine" ? (item as MachineListing).machine_type : (item as StorageListing).storage_type;
  const price = type === "machine" ? (item as MachineListing).price_per_unit : (item as StorageListing).price;
  const pricingUnit = item.pricing_unit;
  const referenceId = item.listing_id;

  // Compute estimated cost based on date difference
  const calculateTotal = () => {
    if (!startDate || !endDate) return price;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (end <= start) return price;

    const diffHours = (end - start) / (1000 * 60 * 60);
    if (pricingUnit === "hour") {
      return Math.max(1, Math.round(diffHours)) * price;
    }
    const diffDays = Math.max(1, Math.round(diffHours / 24));
    if (pricingUnit === "day") {
      return diffDays * price;
    }
    if (pricingUnit === "week") {
      const weeks = Math.max(1, Math.round(diffDays / 7));
      return weeks * price;
    }
    if (pricingUnit === "month") {
      const months = Math.max(1, Math.round(diffDays / 30));
      return months * price;
    }
    return price;
  };

  const estimatedTotal = calculateTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!startDate || !endDate) {
      setError("Please specify both start and end dates.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      setError("End date & time must be strictly after start date & time.");
      return;
    }
    if (user.id === item.owner_id) {
      setError("You cannot book your own listing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const booking = await api.bookings.create(user.id, {
        booking_type: type,
        reference_id: referenceId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        total_price: estimatedTotal,
      });
      onSuccess(`Booking #${booking.booking_id} submitted! Awaiting provider confirmation.`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit booking.");
    } finally {
      setLoading(false);
    }
  };

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
          <div className="grid size-12 place-items-center rounded-2xl bg-[#e6f2e2] text-[#1d5a2b]">
            {type === "machine" ? <Tractor className="size-6" /> : <Warehouse className="size-6" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {type === "machine" ? "Book Equipment" : "Reserve Storage"}
            </h2>
            <p className="text-xs text-slate-500">Rental reservation request</p>
          </div>
        </div>

        {/* Item summary */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-base font-extrabold text-[#d8731c]">
              ₹{price} <span className="text-xs text-slate-400">/ {pricingUnit}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
            <MapPin className="size-3.5" />
            <span>{item.location}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">End Date & Time</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-xs"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#e6f2e2]/60 border border-[#cde5c5] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d5a2b]">Estimated Rental Total:</span>
            <span className="text-lg font-extrabold text-[#1d5a2b]">₹{estimatedTotal.toLocaleString("en-IN")}</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            The equipment or storage owner will receive your request and can confirm or coordinate logistics directly with you.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <><Calendar className="size-4" /> Request Booking</>}
          </button>
        </form>
      </div>
    </div>
  );
}
