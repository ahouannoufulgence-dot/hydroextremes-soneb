import type { StoredDataset } from "@/lib/dataset";
import type { Analysis } from "@/lib/stats";

/** CSV pour Excel français : séparateur « ; », virgule décimale, BOM UTF-8. */
function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000).replace(".", ",") : "";
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function quantilesCsv(analysis: Analysis, unit: string): string {
  const level = Math.round(analysis.confidenceLevel * 100);
  return toCsv(
    ["loi", "methode", "periode_de_retour_ans", `valeur_${unit}`, `ic${level}_bas`, `ic${level}_haut`, "rang_aicc"],
    analysis.results.flatMap((r) => r.quantiles.map((q) => [r.label, r.method, q.period, q.value, q.lower, q.upper, r.rank])),
  );
}

export function annualMaximaCsv(ds: StoredDataset): string {
  return toCsv(
    ["annee", `maximum_${ds.unit}`, "completude_pct", "retenue"],
    ds.annual.map((a) => [a.year, a.max, Math.round(a.completeness * 1000) / 10, a.included ? "oui" : "non"]),
  );
}

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
