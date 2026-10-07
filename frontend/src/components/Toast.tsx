import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastMessage = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 ${
            t.type === "success"
              ? "bg-[#1d5a2b]/95 text-white border-green-600/40"
              : t.type === "error"
              ? "bg-red-700/95 text-white border-red-500/40"
              : "bg-slate-900/90 text-white border-slate-700"
          }`}
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            {t.type === "success" && <CheckCircle2 className="size-5 shrink-0 text-green-300" />}
            {t.type === "error" && <AlertCircle className="size-5 shrink-0 text-red-300" />}
            {t.type === "info" && <Info className="size-5 shrink-0 text-sky-300" />}
            <span>{t.message}</span>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="p-1 rounded-full hover:bg-white/20 transition shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
