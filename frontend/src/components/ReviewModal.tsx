import { useState } from "react";
import { AlertCircle, Loader2, Star, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export function ReviewModal({
  targetUserId,
  targetUserName,
  contextType,
  contextId,
  productTitle,
  onClose,
  onSuccess,
}: {
  targetUserId: number;
  targetUserName?: string;
  contextType?: string;
  contextId?: number;
  productTitle?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.id === targetUserId) {
      setError("You cannot write a review for yourself.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.reviews.create(user.id, {
        reviewed_user_id: targetUserId,
        rating,
        comment: comment.trim() || undefined,
        context_type: contextType,
        context_id: contextId,
      });
      onSuccess("Review submitted! Trust score updated.");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit review.");
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

        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <Star className="size-6" fill="currentColor" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            Leave Feedback
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review for {targetUserName ? <strong>{targetUserName}</strong> : `User #${targetUserId}`}
          </p>
          {productTitle && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              <span>Item:</span> <strong className="font-bold">{productTitle}</strong>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition transform hover:scale-110"
              >
                <Star
                  className={`size-8 ${
                    star <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                  }`}
                />
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Comment / Feedback</label>
            <textarea
              rows={3}
              placeholder="How was the crop quality or service delivery?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
