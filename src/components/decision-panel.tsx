"use client";

import { useState } from "react";
import {
  BarChart3,
  Check,
  CloudRain,
  Download,
  FileText,
  Info,
  Lightbulb,
  ShieldAlert,
  TriangleAlert,
  Waves,
} from "lucide-react";
import {
  CRITICAL_WORKS_PERIOD,
  DEFAULT_ALERT_PERIOD,
  RETURN_PERIODS,
  SCENARIOS,
  applyScenario,
  formatMm,
  type ReturnPeriod,
  type ScenarioId,
} from "@/lib/design-rainfall";
import { exportDecisionPdf } from "@/lib/export-pdf";
import type { Analysis } from "@/lib/stats";
import type { VariableKind } from "@/lib/dataset";

const card = "rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]";

interface DecisionPanelProps {
  analysis: Analysis;
  seriesLabel: string;
  unit: string;
  kind: VariableKind;
  isTestData: boolean;
}

export function DecisionPanel({ analysis, seriesLabel, unit, kind, isTestData }: DecisionPanelProps) {
  const noun = kind === "Pluie" ? "Pluies de projet" : "Débits de projet";
  const bestId = analysis.results.find((r) => r.rank === 1)!.id;
  const [lawId, setLawId] = useState(bestId);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("10");
  const [alertPeriod, setAlertPeriod] = useState<ReturnPeriod>(DEFAULT_ALERT_PERIOD);
  const [exporting, setExporting] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const law = analysis.results.find((r) => r.id === lawId)!;
  const quantile = (t: ReturnPeriod) => law.quantiles.find((q) => q.period === t)!;
  const base = (t: ReturnPeriod) => quantile(t).value;
  const adjusted = (t: ReturnPeriod) => applyScenario(base(t), scenario.uplift);
  const ciPercent = Math.round(analysis.confidenceLevel * 100);

  const alertThreshold = base(alertPeriod);
  const criticalValue = adjusted(CRITICAL_WORKS_PERIOD);

  async function handleExport() {
    setExporting(true);
    try {
      await exportDecisionPdf({
        rows: RETURN_PERIODS.map((t) => ({
          period: t,
          baseMm: base(t),
          adjustedMm: adjusted(t),
          lowerMm: applyScenario(quantile(t).lower, scenario.uplift),
          upperMm: applyScenario(quantile(t).upper, scenario.uplift),
        })),
        lawLabel: law.label,
        method: law.method,
        sampleSize: analysis.n,
        seriesLabel,
        confidenceLevel: analysis.confidenceLevel,
        ksStatistic: law.ks.statistic,
        ksPValue: law.ks.pValue,
        scenarioLabel: scenario.label,
        alertPeriod,
        alertThresholdMm: alertThreshold,
        criticalPeriod: CRITICAL_WORKS_PERIOD,
        criticalMm: criticalValue,
        isTestData,
        unit,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-brand-600">
          <Lightbulb className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Aide à la décision</h1>
          <p className="mt-1 text-muted">
            Outils d&apos;appui pour la conception et la gestion des infrastructures hydrauliques
          </p>
        </div>
      </div>

      <section className={`${card} flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm`}>
        <label className="flex items-center gap-2">
          <span className="font-medium text-brand-900">Loi d&apos;ajustement</span>
          <select
            value={lawId}
            onChange={(e) => setLawId(e.target.value as typeof lawId)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5"
          >
            {[...analysis.results]
              .sort((a, b) => a.rank - b.rank)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} {r.rank === 1 ? "(meilleur AICc)" : ""}
                </option>
              ))}
          </select>
        </label>
        <span className="text-muted">
          {seriesLabel} · n = {analysis.n} maxima annuels · {law.method}
        </span>
        <span className="text-muted">
          KS : D = {law.ks.statistic.toFixed(3)} (p ≈ {law.ks.pValue.toFixed(2)}) · AICc = {law.criteria.aicc.toFixed(1)}
        </span>
      </section>

      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-0.5 size-6 text-brand-600" />
          <div>
            <h2 className="text-lg font-bold text-brand-900">Valeurs de calcul – {noun} ({unit})</h2>
            <p className="text-sm text-muted">
              {kind === "Pluie" ? "Précipitations extrêmes" : "Débits extrêmes"} selon la période de retour (analyse fréquentielle)
              {scenario.uplift > 0 && ` — majorées de ${scenario.label}`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {RETURN_PERIODS.map((t) => (
            <div key={t} className={`${card} p-5 text-center`}>
              <Waves className="mb-2 size-5 text-brand-500" />
              <div className="text-2xl font-semibold text-ink">T = {t} ans</div>
              <hr className="my-3 border-line" />
              <div className="text-4xl font-bold text-brand-900">
                {formatMm(adjusted(t))} <span className="text-2xl">{unit}</span>
              </div>
              <div className="mt-2 text-xs text-muted">
                IC {ciPercent} % : {formatMm(applyScenario(quantile(t).lower, scenario.uplift))} –{" "}
                {formatMm(applyScenario(quantile(t).upper, scenario.uplift))} {unit}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-warn/40 bg-warn-soft/60 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <TriangleAlert className="size-6 text-warn" />
            <h2 className="font-bold text-warn">Recommandation de seuil d&apos;alerte</h2>
            <span className="rounded-full bg-surface px-3 py-0.5 text-xs font-medium text-warn">
              ● Seuil recommandé
            </span>
          </div>
          <p className="mt-4 font-semibold">
            Seuil d&apos;alerte : ≥ {formatMm(alertThreshold)} {unit} (correspond à T = {alertPeriod} ans)
          </p>
          <p className="mt-2 text-sm text-ink/80">
            Ce seuil est recommandé pour la protection des ouvrages et la gestion des risques d&apos;inondation.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            Période de retour du seuil
            <select
              value={alertPeriod}
              onChange={(e) => setAlertPeriod(Number(e.target.value) as ReturnPeriod)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-ink"
            >
              {RETURN_PERIODS.map((t) => (
                <option key={t} value={t}>
                  T = {t} ans
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-warn/30 bg-surface/70 p-3 text-sm">
            <ShieldAlert className="mt-0.5 size-6 shrink-0 text-warn" />
            Déclencher les mesures de vigilance renforcée lorsque la prévision dépasse ce seuil.
          </div>
        </section>

        <section className={`${card} p-5`}>
          <div className="flex items-center gap-3">
            <CloudRain className="size-8 text-brand-500" />
            <h2 className="text-lg font-bold text-brand-900">Scénario climatique</h2>
          </div>
          <p className="mt-3 text-sm text-ink/80">
            Appliquer une augmentation forfaitaire pour tenir compte du changement climatique.
          </p>
          <div role="radiogroup" aria-label="Scénario climatique" className="mt-4 grid grid-cols-3 gap-3">
            {SCENARIOS.map((s) => {
              const selected = s.id === scenarioId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setScenarioId(s.id)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors ${
                    selected
                      ? "border-brand-500 bg-brand-100 text-brand-900"
                      : "border-line bg-surface hover:bg-brand-50"
                  }`}
                >
                  {selected && (
                    <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Info className="size-4 shrink-0" />
            Les valeurs de calcul seront ajustées selon le scénario sélectionné.
          </p>
        </section>
      </div>

      <section className="flex gap-4 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
          <Lightbulb className="size-6" />
        </span>
        <div>
          <h2 className="font-bold text-brand-900">Recommandation</h2>
          <p className="mt-1 text-sm text-ink/90">
            Pour une conception robuste et résiliente, il est recommandé d&apos;utiliser la valeur de T ={" "}
            {CRITICAL_WORKS_PERIOD} ans ({formatMm(base(CRITICAL_WORKS_PERIOD))} {unit})
            {scenario.uplift > 0 ? (
              <>
                {" "}
                avec le scénario {scenario.label} ({formatMm(criticalValue)} {unit})
              </>
            ) : (
              <> sans majoration climatique</>
            )}{" "}
            pour les ouvrages critiques. Ajustez selon le niveau de risque et la criticité de l&apos;infrastructure.
          </p>
        </div>
      </section>

      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex h-12 items-center gap-3 rounded-xl border border-brand-600 bg-surface px-6 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
        >
          <Download className="size-5" />
          {exporting ? "Génération…" : "Exporter PDF"}
          <FileText className="size-5" />
        </button>
        <p className="text-xs text-muted">
          Génère un rapport PDF avec les valeurs calculées, recommandations et métadonnées.
        </p>
      </div>
    </div>
  );
}
