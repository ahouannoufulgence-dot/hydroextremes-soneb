"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useActiveAnalysis } from "./active-analysis";
import { AnalysisPanel } from "./analysis-panel";
import { DecisionPanel } from "./decision-panel";

function Problem({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-warn/40 bg-warn-soft/60 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-6 shrink-0 text-warn" />
        <div>
          <p className="font-semibold">Analyse impossible</p>
          <p className="mt-1 text-sm">{message}</p>
          <Link href="/donnees" className="mt-3 inline-block text-sm font-medium text-brand-700 underline">
            Aller à « Données & import »
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AnalysisScreen() {
  const r = useActiveAnalysis([2, 5, 10, 20, 50, 100, 200]);
  if (!r.analysis || !r.mannKendall || !r.pettitt) return <Problem message={r.error ?? "Analyse indisponible."} />;
  return (
    <AnalysisPanel
      analysis={r.analysis}
      series={r.series}
      mannKendall={r.mannKendall}
      pettitt={r.pettitt}
      seriesLabel={r.label}
      unit={r.dataset.unit}
      kind={r.dataset.kind}
    />
  );
}

export function DecisionScreen() {
  const r = useActiveAnalysis([10, 50, 100, 200]);
  if (!r.analysis) return <Problem message={r.error ?? "Analyse indisponible."} />;
  return <DecisionPanel analysis={r.analysis} seriesLabel={r.label} unit={r.dataset.unit} kind={r.dataset.kind} isTestData={!!r.dataset.isTest} />;
}
