import { useState } from "react";
import { AlertCircle, Container, Loader2, MapPin, ShoppingBag, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import type { CropListing } from "../types";

export function OrderModal({
  listing,
  onClose,
  onSuccess,
}: {
  listing: CropListing;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { user, ensureRole } = useAuth();
  const [quantity, setQuantity] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numQty = parseFloat(quantity) || 0;
  const totalPrice = numQty * listing.price_per_kg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (numQty <= 0) {
      setError("Please specify a valid quantity.");
      return;
    }
    if (numQty > listing.quantity_remaining) {
      setError(`Cannot order more than available stock (${listing.quantity_remaining} ${listing.unit}).`);
      return;
    }
    if (user.id === listing.user_id) {
      setError("You cannot order your own harvest listing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await ensureRole("buyer");
      const order = await api.orders.create(user.id, listing.id, numQty);
      onSuccess(`Order #${order.order_id} placed! The farmer will review and confirm.`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to place order.");
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
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Purchase Harvest</h2>
            <p className="text-xs text-slate-500">Direct order from farmer</p>
          </div>
        </div>

        {/* Listing preview */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-slate-900">{listing.crop_name}</h3>
              <p className="text-xs text-slate-500">{listing.category} · {listing.quality_grade || "Standard"}</p>
            </div>
            <p className="text-base font-extrabold text-[#d8731c]">
              ₹{listing.price_per_kg} <span className="text-xs text-slate-400">/ {listing.unit}</span>
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{listing.location}</span>
            <span className="font-semibold text-emerald-700">{listing.quantity_remaining} {listing.unit} remaining</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Quantity to Order ({listing.unit})
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="1"
                max={listing.quantity_remaining}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] font-bold text-base"
              />
              <button
                type="button"
                onClick={() => setQuantity(listing.quantity_remaining.toString())}
                className="px-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 transition"
              >
                Max Stock
              </button>
            </div>
          </div>

          {/* Pricing Calculation summary */}
          <div className="p-3.5 rounded-2xl bg-[#e6f2e2]/60 border border-[#cde5c5] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d5a2b]">Estimated Total Price:</span>
            <span className="text-lg font-extrabold text-[#1d5a2b]">₹{totalPrice.toLocaleString("en-IN")}</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Upon submitting, order status will be set to <strong>Pending</strong>. Stock will be reserved once the grower confirms.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <><Container className="size-4" /> Confirm & Place Order</>}
          </button>
        </form>
      </div>
    </div>
  );
}
