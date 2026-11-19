import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, MessageCircle, Stethoscope, X } from "lucide-react";
import { doctorApi } from "../api";
import { useAuth } from "../auth";
import type { CropDiagnosis, CropIssue } from "../types";
import { FormError } from "./AuthSheet";
import { Field } from "./formKit";
import { inputClass as input, primaryClass as primary } from "./formStyles";
import { Sheet } from "./Sheet";

type Photo = { file: File; url: string };
const LANG_LABEL: Record<string, string> = { English: "English", Telugu: "తెలుగు (Telugu)", Hindi: "हिन्दी (Hindi)" };
const MAX_SIDE = 1600;

/** Shrink a phone photo (often 4000+ px, 5-10 MB) before upload: faster on mobile data, same diagnosis quality. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

const HEALTH: Record<CropDiagnosis["overall_health"], { label: string; cls: string }> = {
  healthy: { label: "Looks healthy", cls: "bg-[#e3f0de] text-[#1d5a2b]" },
  minor_problem: { label: "Minor problem", cls: "bg-amber-100 text-amber-800" },
  needs_attention: { label: "Needs attention", cls: "bg-orange-100 text-orange-800" },
  urgent: { label: "Act quickly", cls: "bg-red-100 text-red-800" },
};
const SEVERITY: Record<CropIssue["severity"], string> = { mild: "bg-[#e3f0de] text-[#1d5a2b]", moderate: "bg-orange-100 text-orange-800", severe: "bg-red-100 text-red-800" };
const KIND: Record<CropIssue["kind"], string> = { disease: "Disease", pest: "Pest", nutrient_deficiency: "Nutrient deficiency", water_or_weather_stress: "Water / weather stress", other: "Other" };

const List = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) => items.length === 0 ? null : (
  <section className="mt-4">
    <h4 className={`text-sm font-bold ${tone ?? "text-slate-800"}`}>{title}</h4>
    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  </section>
);

function shareText(d: CropDiagnosis): string {
  const lines = [`Crop Doctor - ${d.crop}`, d.summary, ""];
  d.issues.forEach((i) => lines.push(`• ${i.name} (${i.severity}, ${i.confidence} confidence)`));
  if (d.treatment.do_now.length) lines.push("", "What to do now:", ...d.treatment.do_now.map((t) => `- ${t}`));
  lines.push("", "AI guidance from Farma Bridge, not a substitute for an agriculture officer.");
  return lines.join("\n");
}

function Result({ d, onAgain }: { d: CropDiagnosis; onAgain: () => void }) {
  const h = HEALTH[d.overall_health];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${h.cls}`}>{h.label}</span>
        <span className="text-sm text-slate-600">Crop: <b>{d.crop}</b></span>
      </div>
      <p className="mt-3 leading-6">{d.summary}</p>

      {!d.image_usable && (
        <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={16} />The photos weren't clear enough to be sure. See the tips below and try again.</p>
      )}

      {d.issues.map((i, idx) => (
        <article key={idx} className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{i.name}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{KIND[i.kind]}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SEVERITY[i.severity]}`}>{i.severity}</span>
            <span className="text-xs text-slate-500">{i.confidence} confidence</span>
          </div>
          <List title="What I can see" items={i.symptoms_seen} />
          <p className="mt-3 text-sm text-slate-700"><b>Why it happens:</b> {i.likely_cause}</p>
        </article>
      ))}

      <List title="What to do now" items={d.treatment.do_now} tone="text-[#1d5a2b]" />
      <List title="Organic options" items={d.treatment.organic_options} />
      {d.treatment.chemical_options.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <List title="Chemical options (only if needed)" items={d.treatment.chemical_options} />
          <p className="mt-2 text-xs text-slate-500">Always follow the product label, wear protective gear and check what is allowed in your area. Ask your agri shop or officer for the right dose.</p>
        </div>
      )}
      <List title="How to prevent it next time" items={d.prevention} />
      <List title="Photos that would help" items={d.better_photos_tips} />

      {d.see_an_expert && (
        <p className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span><b>Please show this to an expert.</b> {d.expert_reason} Your nearest Krishi Vigyan Kendra or agriculture officer can inspect the field.</span></p>
      )}

      <p className="mt-4 text-xs text-slate-500">This is AI guidance from photos, not a lab test or a field visit. When in doubt, ask an agriculture officer.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText(d))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"><MessageCircle size={16} />Share on WhatsApp</a>
        <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold" onClick={onAgain}>Check another plant</button>
      </div>
    </div>
  );
}

export function CropDoctorSheet({ onClose, onNeedSignIn }: { onClose: () => void; onNeedSignIn: () => void }) {
  const { user } = useAuth();
  const status = useQuery({ queryKey: ["doctor-status"], queryFn: doctorApi.status });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [crop, setCrop] = useState("");
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem("doctor.lang") ?? "English"; } catch { return "English"; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CropDiagnosis | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const max = status.data?.max_images ?? 4;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= max) { setError(`You can add up to ${max} photos.`); break; }
      if (!file.type.startsWith("image/")) { setError("Please choose photos only."); continue; }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
  };
  const remove = (i: number) => { URL.revokeObjectURL(photos[i].url); setPhotos(photos.filter((_, k) => k !== i)); };
  const reset = () => { photos.forEach((p) => URL.revokeObjectURL(p.url)); setPhotos([]); setResult(null); setNotes(""); setError(""); };
  const pickLanguage = (l: string) => { setLanguage(l); try { localStorage.setItem("doctor.lang", l); } catch { /* optional */ } };

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const small = await Promise.all(photos.map((p) => shrink(p.file)));
      setResult(await doctorApi.diagnose(small, { crop_name: crop.trim() || undefined, notes: notes.trim() || undefined, language }));
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <Sheet title="Crop Doctor" onClose={onClose} wide>
      <div className="flex items-center gap-3 pr-10">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e3f0de] text-[#1d5a2b]"><Stethoscope /></span>
        <div><h2 className="text-xl font-bold">Crop Doctor</h2><p className="text-sm text-slate-600">Photograph the sick plant. I'll tell you what looks wrong and what to do.</p></div>
      </div>

      <div className="mt-5">
        {status.isLoading && <p className="text-slate-500">Loading…</p>}
        {status.data && !status.data.enabled && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Crop Doctor isn't switched on yet. The site owner needs to add a Groq API key (see the README), then it will work here.</p>
        )}
        {status.data?.enabled && !user && (
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="font-semibold">Sign in to check your crop</p>
            <button className={`${primary} mt-3`} onClick={onNeedSignIn}>Sign in</button>
          </div>
        )}

        {status.data?.enabled && user && result && <Result d={result} onAgain={reset} />}

        {status.data?.enabled && user && !result && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Photos ({photos.length}/{max})</p>
              <p className="text-xs text-slate-500">Take a close-up of the affected leaf, and one of the whole plant. Daylight, in focus, no filters.</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                    <img src={p.url} alt={`Crop photo ${i + 1}`} className="size-full object-cover" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={photos.length >= max} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d5a2b] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" onClick={() => camera.current?.click()}><Camera size={16} />Take photo</button>
                <button type="button" disabled={photos.length >= max} className="inline-flex items-center gap-1.5 rounded-xl border border-[#1d5a2b] px-4 py-2.5 text-sm font-bold text-[#1d5a2b] disabled:opacity-50" onClick={() => gallery.current?.click()}><ImagePlus size={16} />From gallery</button>
              </div>
              <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="Which crop? (optional)"><input className={input} maxLength={60} placeholder="e.g. Tomato, Chilli, Paddy" value={crop} onChange={(e) => setCrop(e.target.value)} /></Field>
              <Field name="Reply in"><select className={input} value={language} onChange={(e) => pickLanguage(e.target.value)}>{(status.data.languages ?? ["English"]).map((l) => <option key={l} value={l}>{LANG_LABEL[l] ?? l}</option>)}</select></Field>
            </div>
            <Field name="Anything else? (optional)"><textarea className={input} rows={2} maxLength={600} placeholder="When did it start? Which leaves? Recent rain, spray or fertiliser?" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

            <FormError message={error} />
            <button className={primary} disabled={busy || photos.length === 0} onClick={submit}>
              {busy ? <><Loader2 className="animate-spin" size={18} />Looking at your plant… (about 20-40 seconds)</> : <><CheckCircle2 size={18} />Check my crop</>}
            </button>
            <p className="text-center text-xs text-slate-500">Photos are sent to an AI service (Groq) for this one check and are not saved by Farma Bridge. Up to {status.data.max_per_hour} checks per hour.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
