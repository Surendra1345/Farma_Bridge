import { AlertTriangle, MessageCircle } from "lucide-react";
import type { CropDiagnosis, CropIssue } from "../types";

export const LANG_LABEL: Record<string, string> = { English: "English", Telugu: "తెలుగు (Telugu)", Hindi: "हिन्दी (Hindi)" };
const MAX_SIDE = 1600;

/** Shrink a phone photo (often 4000+ px, 5-10 MB) before upload: faster on mobile data, same diagnosis quality. */
export async function shrinkImage(file: File): Promise<File> {
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
  <section className="mt-3">
    <h4 className={`text-sm font-bold ${tone ?? "text-slate-800"}`}>{title}</h4>
    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  </section>
);

/** Plain-text version of a diagnosis: shared on WhatsApp, and given to the chat assistant as context for follow-up questions. */
export function diagnosisText(d: CropDiagnosis): string {
  const lines = [`Crop photo check for ${d.crop}: ${d.summary}`];
  d.issues.forEach((i) => lines.push(`- ${i.name} (${i.severity}, ${i.confidence} confidence)`));
  if (d.treatment.do_now.length) lines.push("What to do now:", ...d.treatment.do_now.map((t) => `- ${t}`));
  return lines.join("\n");
}

export function DiagnosisView({ d }: { d: CropDiagnosis }) {
  const h = HEALTH[d.overall_health];
  const share = `${diagnosisText(d)}\n\nAI guidance from Farma Bridge, not a substitute for an agriculture officer.`;
  return (
    <div className="text-left">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${h.cls}`}>{h.label}</span>
        <span className="text-sm text-slate-600">Crop: <b>{d.crop}</b></span>
      </div>
      <p className="mt-2 text-sm leading-6">{d.summary}</p>

      {!d.image_usable && (
        <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={16} />The photos weren't clear enough to be sure. See the tips below and try again.</p>
      )}

      {d.issues.map((i, idx) => (
        <article key={idx} className="mt-3 rounded-2xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{i.name}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{KIND[i.kind]}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SEVERITY[i.severity]}`}>{i.severity}</span>
            <span className="text-xs text-slate-500">{i.confidence} confidence</span>
          </div>
          <List title="What I can see" items={i.symptoms_seen} />
          <p className="mt-2 text-sm text-slate-700"><b>Why it happens:</b> {i.likely_cause}</p>
        </article>
      ))}

      <List title="What to do now" items={d.treatment.do_now} tone="text-[#1d5a2b]" />
      <List title="Organic options" items={d.treatment.organic_options} />
      {d.treatment.chemical_options.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <List title="Chemical options (only if needed)" items={d.treatment.chemical_options} />
          <p className="mt-2 text-xs text-slate-500">Always follow the product label, wear protective gear and check what is allowed in your area. Ask your agri shop or officer for the right dose.</p>
        </div>
      )}
      <List title="How to prevent it next time" items={d.prevention} />
      <List title="Photos that would help" items={d.better_photos_tips} />

      {d.see_an_expert && (
        <p className="mt-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span><b>Please show this to an expert.</b> {d.expert_reason} Your nearest Krishi Vigyan Kendra or agriculture officer can inspect the field.</span></p>
      )}

      <p className="mt-3 text-xs text-slate-500">AI guidance from photos, not a lab test or a field visit. When in doubt, ask an agriculture officer.</p>
      <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"><MessageCircle size={16} />Share on WhatsApp</a>
    </div>
  );
}
