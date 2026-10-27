import type { LucideIcon } from "lucide-react";

type Tone = "ok" | "danger" | "neutral";

const dot: Record<Tone, string> = {
  ok: "bg-ok",
  danger: "bg-danger",
  neutral: "bg-muted",
};

interface KpiCardProps {
  icon: LucideIcon;
  value: string;
  unit?: string;
  label: string;
  detail: string;
  detailTone?: Tone;
  highlight?: boolean;
}

export function KpiCard({ icon: Icon, value, unit, label, detail, detailTone, highlight }: KpiCardProps) {
  return (
    <div className="flex items-center gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className={`text-3xl font-bold leading-none ${highlight ? "text-brand-600" : "text-brand-900"}`}>
          {value}
          {unit && <span className="ml-1 text-2xl">{unit}</span>}
        </div>
        <div className="mt-1.5 text-[15px] text-ink">{label}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          {detailTone && <span className={`size-2 rounded-full ${dot[detailTone]}`} />}
          {detail}
        </div>
      </div>
    </div>
  );
}
