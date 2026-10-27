"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import type { VariableKind } from "@/lib/dataset";
import { DISTRIBUTIONS, weibullPositions, type Analysis, type MannKendallResult, type PettittResult } from "@/lib/stats";

const card = "rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]";

const LAW_COLORS: Record<string, string> = {
  gumbel: "#0b63ce",
  gev: "#2e9e5b",
  lognormal: "#f28c28",
  lp3: "#7c4dff",
};

/** Variable réduite de Gumbel : u = -ln(-ln p). Les axes « papier de probabilité » s'y alignent. */
const toU = (T: number) => -Math.log(-Math.log(1 - 1 / T));
const toT = (u: number) => 1 / (1 - Math.exp(-Math.exp(-u)));
const TICK_PERIODS = [2, 5, 10, 20, 50, 100, 200];

const fmt = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });

interface Props {
  analysis: Analysis;
  series: { year: number; max: number }[];
  mannKendall: MannKendallResult;
  pettitt: PettittResult;
  seriesLabel: string;
  unit: string;
  kind: VariableKind;
}

export function AnalysisPanel({ analysis, series, mannKendall, pettitt, seriesLabel, unit, kind }: Props) {
  const best = analysis.results.find((r) => r.rank === 1)!;
  const [selectedId, setSelectedId] = useState(best.id);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const selected = analysis.results.find((r) => r.id === selectedId)!;
  const ciPercent = Math.round(analysis.confidenceLevel * 100);

  const { rows, points } = useMemo(() => {
    const ci = [...selected.quantiles].sort((a, b) => a.period - b.period).map((q) => ({ u: toU(q.period), lo: q.lower, hi: q.upper }));
    const interpolate = (u: number, key: "lo" | "hi") => {
      if (u < ci[0].u || u > ci[ci.length - 1].u) return undefined;
      for (let i = 0; i < ci.length - 1; i++) {
        if (u >= ci[i].u && u <= ci[i + 1].u) {
          const w = (u - ci[i].u) / (ci[i + 1].u - ci[i].u);
          return ci[i][key] + w * (ci[i + 1][key] - ci[i][key]);
        }
      }
      return undefined;
    };

    const N = 80;
    const rows = Array.from({ length: N }, (_, i) => {
      const u = -1.5 + (i * 7.9) / (N - 1);
      const p = Math.exp(-Math.exp(-u));
      const row: Record<string, number | number[] | null | undefined> = { u };
      for (const r of analysis.results) {
        const dist = DISTRIBUTIONS.find((d) => d.id === r.id)!;
        const y = dist.ppf(p, r.params);
        row[r.id] = Number.isFinite(y) ? y : null;
      }
      const lo = interpolate(u, "lo");
      const hi = interpolate(u, "hi");
      row.band = lo !== undefined && hi !== undefined ? [lo, hi] : undefined;
      return row;
    });

    const points = weibullPositions(analysis.empirical.map((e) => e.value)).map((e) => ({
      u: -Math.log(-Math.log(e.probability)),
      value: e.value,
    }));
    return { rows, points };
  }, [analysis, selected]);

  const mean = analysis.summary.mean;

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const periods = analysis.results[0].quantiles.map((q) => q.period);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-brand-600">
          <LineChartIcon className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Analyse & fréquences</h1>
          <p className="mt-1 text-muted">
            Ajustement des lois statistiques aux maxima annuels — {seriesLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          ["Effectif", `${analysis.n} ans`],
          ["Moyenne", `${fmt(analysis.summary.mean)} ${unit}`],
          ["Écart-type", `${fmt(analysis.summary.std)} ${unit}`],
          ["Asymétrie", fmt(analysis.summary.skewness, 2)],
          ["Min – Max", `${fmt(analysis.summary.min, 0)} – ${fmt(analysis.summary.max, 0)} ${unit}`],
        ].map(([label, value]) => (
          <div key={label} className={`${card} px-4 py-3`}>
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-0.5 text-xl font-bold text-brand-900">{value}</div>
          </div>
        ))}
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-brand-900">Ajustement sur papier de probabilité (Gumbel)</h2>
            <p className="text-sm text-muted">
              Points observés (position de Weibull) et courbes des lois ajustées. Bande : intervalle de confiance à {ciPercent} % de la loi
              sélectionnée.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-brand-900">Loi sélectionnée</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value as typeof selectedId)}
              className="rounded-lg border border-line bg-surface px-2 py-1.5"
            >
              {[...analysis.results]
                .sort((a, b) => a.rank - b.rank)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.rank === 1 ? " (meilleur AICc)" : ""}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {analysis.results.map((r) => {
            const on = !hidden.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(r.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
                  on ? "border-line bg-surface" : "border-transparent bg-canvas text-muted line-through"
                }`}
              >
                <span className="h-0.5 w-5 rounded" style={{ background: LAW_COLORS[r.id] }} />
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 h-[420px]" role="img" aria-label="Papier de probabilité : maxima annuels observés et lois ajustées">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 10, right: 16, bottom: 24, left: 4 }}>
              <CartesianGrid stroke="#e2e9f3" strokeDasharray="3 3" />
              <XAxis
                dataKey="u"
                type="number"
                domain={[-1.5, 6.4]}
                ticks={TICK_PERIODS.map(toU)}
                tickFormatter={(u: number) => String(Math.round(toT(u)))}
                tick={{ fill: "#5b6b82", fontSize: 12 }}
                label={{ value: "Période de retour T (ans)", position: "insideBottom", offset: -12, fill: "#5b6b82", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "#5b6b82", fontSize: 12 }}
                domain={[0, "auto"]}
                label={{ value: `${kind === "Pluie" ? "Pluie journalière maximale" : "Débit journalier maximal"} (${unit})`, angle: -90, position: "insideLeft", fill: "#5b6b82", fontSize: 12 }}
              />
              <Tooltip
                labelFormatter={(u) => `T ≈ ${fmt(toT(Number(u)))} ans`}
                formatter={(v) =>
                  Array.isArray(v) ? `${Math.round(Number(v[0]))} – ${Math.round(Number(v[1]))} ${unit}` : `${Math.round(Number(v))} ${unit}`
                }
              />
              <Area
                dataKey="band"
                name={`IC ${ciPercent} % (${selected.label})`}
                stroke="none"
                fill={LAW_COLORS[selected.id]}
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls={false}
              />
              {analysis.results.map((r) =>
                hidden.has(r.id) ? null : (
                  <Line
                    key={r.id}
                    dataKey={r.id}
                    name={r.label}
                    type="monotone"
                    dot={false}
                    stroke={LAW_COLORS[r.id]}
                    strokeWidth={r.id === selectedId ? 3 : 1.6}
                    strokeOpacity={r.id === selectedId ? 1 : 0.75}
                    isAnimationActive={false}
                  />
                ),
              )}
              <Scatter data={points} dataKey="value" name="Observations" fill="#0f1f3d" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} p-5 lg:col-span-2`}>
          <h2 className="font-bold text-brand-900">Maxima annuels</h2>
          <p className="text-sm text-muted">Série utilisée pour l&apos;ajustement (ligne : moyenne).</p>
          <div className="mt-3 h-56" role="img" aria-label="Maxima annuels par année">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#e2e9f3" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: "#5b6b82", fontSize: 11 }} interval={4} />
                <YAxis tick={{ fill: "#5b6b82", fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} ${unit}`} labelFormatter={(y) => `Année ${y}`} />
                <ReferenceLine y={mean} stroke="#f28c28" strokeDasharray="4 4" />
                <Bar dataKey="max" name="Maximum annuel" fill="#1a73e8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={`${card} space-y-4 p-5`}>
          <h2 className="flex items-center gap-2 font-bold text-brand-900">
            <TrendingUp className="size-5 text-brand-600" /> Tendance et rupture
          </h2>
          <div>
            <div className="text-sm font-medium">Mann-Kendall</div>
            <div className="text-sm text-muted">
              {mannKendall.trend === "aucune"
                ? "Pas de tendance significative"
                : `Tendance à la ${mannKendall.trend} significative`}{" "}
              (Z = {fmt(mannKendall.z, 2)}, p = {fmt(mannKendall.pValue, 3)}). Pente de Sen : {fmt(mannKendall.senSlope, 2)} {unit}/an.
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Pettitt</div>
            <div className="text-sm text-muted">
              {pettitt.pValue < 0.05 ? "Rupture probable" : "Pas de rupture significative"} (p ≈ {fmt(pettitt.pValue, 3)}
              {pettitt.pValue < 0.05 ? `, après ${series[pettitt.changeIndex].year}` : ""}).
            </div>
          </div>
          <p className="text-xs text-muted">
            Une tendance ou une rupture remet en cause l&apos;hypothèse de stationnarité : à discuter dans le mémoire.
          </p>
        </section>
      </div>

      <section className={`${card} overflow-x-auto p-5`}>
        <h2 className="flex items-center gap-2 font-bold text-brand-900">
          <Activity className="size-5 text-brand-600" /> Comparaison des lois
        </h2>
        <table className="mt-3 w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3">Rang</th>
              <th className="pr-3">Loi</th>
              <th className="pr-3">Méthode</th>
              <th className="pr-3">Paramètres</th>
              <th className="pr-3">KS (D · p)</th>
              <th className="pr-3">AICc</th>
              <th>BIC</th>
            </tr>
          </thead>
          <tbody>
            {[...analysis.results]
              .sort((a, b) => a.rank - b.rank)
              .map((r) => (
                <tr key={r.id} className={`border-b border-line/70 ${r.id === selectedId ? "bg-brand-50" : ""}`}>
                  <td className="py-2.5 pr-3 font-semibold">{r.rank}</td>
                  <td className="pr-3 font-medium">
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: LAW_COLORS[r.id] }} />
                    {r.label}
                  </td>
                  <td className="pr-3 text-muted">{r.method}</td>
                  <td className="pr-3 tabular-nums">
                    {r.paramNames.map((n, i) => `${n} = ${fmt(r.params[i], 3)}`).join(" · ")}
                  </td>
                  <td className="pr-3 tabular-nums">
                    {fmt(r.ks.statistic, 3)} · {fmt(r.ks.pValue, 2)}
                  </td>
                  <td className="pr-3 tabular-nums">{fmt(r.criteria.aicc)}</td>
                  <td className="tabular-nums">{fmt(r.criteria.bic)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Plus l&apos;AICc est faible, meilleur est l&apos;ajustement (pénalisé par le nombre de paramètres). Les p-values du test KS sont
          approximatives car les paramètres sont estimés sur la même série.
        </p>
      </section>

      <section className={`${card} overflow-x-auto p-5`}>
        <h2 className="font-bold text-brand-900">Quantiles de {kind === "Pluie" ? "pluie" : "débit"} ({unit})</h2>
        <table className="mt-3 w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3">T (ans)</th>
              {analysis.results.map((r) => (
                <th key={r.id} className="pr-3">
                  {r.label}
                </th>
              ))}
              <th>IC {ciPercent} % ({selected.label})</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((T, i) => (
              <tr key={T} className="border-b border-line/70">
                <td className="py-2.5 pr-3 font-semibold">{T}</td>
                {analysis.results.map((r) => (
                  <td key={r.id} className={`pr-3 tabular-nums ${r.id === selectedId ? "font-semibold text-brand-900" : ""}`}>
                    {fmt(r.quantiles[i].value)}
                  </td>
                ))}
                <td className="tabular-nums text-muted">
                  {fmt(selected.quantiles[i].lower)} – {fmt(selected.quantiles[i].upper)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Intervalles de confiance par bootstrap paramétrique ; la bande du graphique est interpolée entre ces périodes de retour.
        </p>
      </section>
    </div>
  );
}
