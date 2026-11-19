import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, MessageCircle, Send, Sprout, X } from "lucide-react";
import { assistantApi, doctorApi } from "../api";
import { useAuth } from "../auth";
import type { CropDiagnosis } from "../types";
import { DiagnosisView, LANG_LABEL, diagnosisText, shrinkImage } from "./DiagnosisView";

/** One chat bubble. `local` bubbles are written by the app itself (welcome, sign-in prompt) and are not sent to the AI. */
type Msg = {
  id: number; role: "user" | "assistant"; text?: string; photos?: string[]; diagnosis?: CropDiagnosis;
  signIn?: boolean; error?: boolean; local?: boolean;
};
type Photo = { file: File; url: string };

const WELCOME = "Hi! I'm the Farma Bridge assistant. Ask me what this app is for and how to use it: selling, buying, booking, payments and more. You don't need to sign in to chat. To check a sick plant, attach a photo (that needs a sign-in).";
const SUGGESTIONS = ["What is Farma Bridge?", "How do I sell my crop?", "How do I book a tractor?", "How does payment work?"];
const MAX_PHOTOS = 3;
let nextId = 1;

export function ChatWidget({ onNeedSignIn }: { onNeedSignIn: () => void }) {
  const { user } = useAuth();
  const status = useQuery({ queryKey: ["assistant-status"], queryFn: assistantApi.status, staleTime: 5 * 60_000 });
  const doctor = useQuery({ queryKey: ["doctor-status"], queryFn: doctorApi.status, staleTime: 5 * 60_000 });
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: nextId++, role: "assistant", text: WELCOME, local: true }]);
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<"" | "chat" | "photo">("");
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem("doctor.lang") ?? "English"; } catch { return "English"; } });
  const [nudge, setNudge] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const maxPhotos = Math.min(MAX_PHOTOS, doctor.data?.max_images ?? MAX_PHOTOS);
  const enabled = status.data?.enabled ?? true;
  const maxChars = status.data?.max_message_chars ?? 600;

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);
  useEffect(() => { if (open) { setNudge(false); setTimeout(() => input.current?.focus(), 50); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { const t = setTimeout(() => setNudge(false), 9000); return () => clearTimeout(t); }, []);

  const push = (m: Omit<Msg, "id">) => setMsgs((cur) => [...cur, { ...m, id: nextId++ }]);
  const pickLanguage = (l: string) => { setLanguage(l); try { localStorage.setItem("doctor.lang", l); } catch { /* optional */ } };

  /** What the AI sees: recent text turns only (diagnoses become a short text summary so follow-ups make sense). */
  const history = (extra: string) => [
    ...msgs.filter((m) => !m.local && !m.error && !m.signIn).slice(-9).map((m) => ({
      role: m.role, content: (m.diagnosis ? diagnosisText(m.diagnosis) : m.text ?? "(photo)").slice(0, 1400),
    })),
    { role: "user" as const, content: extra },
  ];

  const attach = () => {
    if (!user) {      // photo checks need an account; chatting does not
      push({ role: "assistant", text: "To check a crop photo you need to sign in first. Chatting with me about the app doesn't need an account.", signIn: true, local: true });
      return;
    }
    files.current?.click();
  };

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= maxPhotos) { push({ role: "assistant", text: `You can add up to ${maxPhotos} photos at a time.`, local: true }); break; }
      if (file.type.startsWith("image/")) next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
  };
  const removePhoto = (i: number) => { URL.revokeObjectURL(photos[i].url); setPhotos(photos.filter((_, k) => k !== i)); };

  const send = async (override?: string) => {
    const text = (override ?? draft).trim().slice(0, maxChars);
    if ((!text && photos.length === 0) || busy || !enabled) return;
    setDraft("");

    if (photos.length > 0) {                       // crop photo check (signed-in users only)
      if (!user) { attach(); return; }
      const shown = photos.map((p) => p.url);
      const toSend = photos.map((p) => p.file);
      setPhotos([]);
      push({ role: "user", text: text || undefined, photos: shown });
      setBusy("photo");
      try {
        const small = await Promise.all(toSend.map(shrinkImage));
        push({ role: "assistant", diagnosis: await doctorApi.diagnose(small, { notes: text || undefined, language }) });
      } catch (e) {
        push({ role: "assistant", text: e instanceof Error ? e.message : "Something went wrong. Please try again.", error: true });
      } finally { setBusy(""); }
      return;
    }

    const turns = history(text);
    push({ role: "user", text });
    setBusy("chat");
    try {
      const r = await assistantApi.chat(turns);
      push({ role: "assistant", text: r.reply });
    } catch (e) {
      push({ role: "assistant", text: e instanceof Error ? e.message : "Something went wrong. Please try again.", error: true });
    } finally { setBusy(""); }
  };

  if (!open) {
    return (
      <div className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6">
        {nudge && (
          <button onClick={() => setOpen(true)} className="absolute bottom-16 right-0 w-56 rounded-2xl rounded-br-sm bg-white p-3 text-left text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200">
            Questions about Farma Bridge? Ask me.
          </button>
        )}
        <button onClick={() => setOpen(true)} aria-label="Chat with the Farma Bridge assistant"
          className="grid size-14 place-items-center rounded-full bg-[#1d5a2b] text-white shadow-xl ring-4 ring-white/70 transition hover:scale-105 hover:bg-[#174d24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d5a2b]">
          <MessageCircle size={26} />
        </button>
      </div>
    );
  }

  const onlyWelcome = msgs.length === 1;
  return (
    <section role="dialog" aria-label="Farma Bridge assistant"
      className="fixed inset-x-0 bottom-0 z-[35] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:h-[620px] md:max-h-[calc(100dvh-3rem)] md:w-[410px] md:rounded-3xl">
      <header className="flex items-center gap-3 bg-[#1d5a2b] px-4 py-3 text-white">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15"><Sprout size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold leading-tight">Farma Bridge assistant</h2>
          <p className="truncate text-xs text-green-100">Ask about the app · photo checks need sign-in</p>
        </div>
        <button className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Close chat" onClick={() => setOpen(false)}><X size={20} /></button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f8f3] px-3 py-4" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${m.role === "user" ? "rounded-br-sm bg-[#1d5a2b] text-white" : m.error ? "rounded-bl-sm bg-red-50 text-red-800 ring-1 ring-red-200" : "rounded-bl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"} ${m.diagnosis ? "w-full max-w-full" : ""}`}>
              {m.photos && <div className="mb-2 flex gap-1.5">{m.photos.map((u) => <img key={u} src={u} alt="Crop photo you sent" className="size-16 rounded-lg object-cover" />)}</div>}
              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              {m.diagnosis && <DiagnosisView d={m.diagnosis} />}
              {m.signIn && <button className="mt-2 rounded-lg bg-[#1d5a2b] px-4 py-1.5 text-sm font-bold text-white" onClick={onNeedSignIn}>Sign in</button>}
            </div>
          </div>
        ))}

        {onlyWelcome && enabled && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-[#1d5a2b]/30 bg-white px-3 py-1.5 text-sm font-medium text-[#1d5a2b] hover:bg-[#eaf4e5]">{s}</button>)}
            <button onClick={attach} className="rounded-full border border-[#1d5a2b]/30 bg-white px-3 py-1.5 text-sm font-medium text-[#1d5a2b] hover:bg-[#eaf4e5]">Check my crop's photo</button>
          </div>
        )}

        {busy && (
          <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            <Loader2 className="animate-spin" size={15} />{busy === "photo" ? "Looking at your photo…" : "Typing…"}
          </div></div>
        )}
        {!enabled && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The assistant isn't switched on yet. The site owner needs to add a Groq API key.</p>}
        <div ref={end} />
      </div>

      <footer className="border-t border-slate-200 bg-white p-3">
        {photos.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative size-14 overflow-hidden rounded-lg bg-slate-100">
                <img src={p.url} alt={`Photo ${i + 1} to check`} className="size-full object-cover" />
                <button aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)} className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"><X size={12} /></button>
              </div>
            ))}
            <select aria-label="Language for the photo result" value={language} onChange={(e) => pickLanguage(e.target.value)} className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {(doctor.data?.languages ?? ["English", "Telugu", "Hindi"]).map((l) => <option key={l} value={l}>{LANG_LABEL[l] ?? l}</option>)}
            </select>
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <button type="button" aria-label="Attach crop photos" title="Check a crop photo (sign-in needed)" disabled={!enabled || !!busy} onClick={attach}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-slate-300 text-[#1d5a2b] hover:bg-[#eaf4e5] disabled:opacity-50"><ImagePlus size={19} /></button>
          <input ref={files} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          <textarea ref={input} rows={1} value={draft} maxLength={maxChars} disabled={!enabled} aria-label="Your message"
            placeholder={photos.length ? "Describe the problem (optional)…" : "Ask about Farma Bridge…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#1d5a2b] focus:ring-2 focus:ring-[#1d5a2b]/20" />
          <button type="submit" aria-label="Send message" disabled={!enabled || !!busy || (!draft.trim() && photos.length === 0)}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1d5a2b] text-white hover:bg-[#174d24] disabled:opacity-50"><Send size={18} /></button>
        </form>
        <p className="mt-2 text-center text-[11px] text-slate-400">AI assistant. It only answers questions about Farma Bridge and can make mistakes.</p>
      </footer>
    </section>
  );
}
