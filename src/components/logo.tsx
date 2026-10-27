import { Droplet } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white">
        <Droplet className="size-5" fill="currentColor" strokeWidth={1.5} />
      </span>
      <div className="leading-tight">
        <div className="text-[17px] font-bold text-brand-900">HydroExtrêmes</div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-brand-600">SONEB</div>
      </div>
    </div>
  );
}
