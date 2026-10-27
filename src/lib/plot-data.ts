import { DISTRIBUTIONS, weibullPositions, type Analysis } from "@/lib/stats";

/** Variable réduite de Gumbel : u = -ln(-ln p). Sur cet axe, une loi de Gumbel est une droite. */
export const toU = (T: number) => -Math.log(-Math.log(1 - 1 / T));
export const toT = (u: number) => 1 / (1 - Math.exp(-Math.exp(-u)));
export const TICK_PERIODS = [2, 5, 10, 20, 50, 100, 200];
export const U_MIN = -1.5;
export const U_MAX = 6.4;

export type PlotRow = Record<string, number | number[] | null | undefined>;

/** Courbes des lois, bande de confiance (loi sélectionnée) et points observés pour le papier de probabilité. */
export function buildPlotData(analysis: Analysis, selectedId: string) {
  const selected = analysis.results.find((r) => r.id === selectedId) ?? analysis.results[0];
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
  const rows: PlotRow[] = Array.from({ length: N }, (_, i) => {
    const u = U_MIN + (i * (U_MAX - U_MIN)) / (N - 1);
    const p = Math.exp(-Math.exp(-u));
    const row: PlotRow = { u };
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
}
