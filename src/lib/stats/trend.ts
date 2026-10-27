import { normalCdf } from "./special";

export interface MannKendallResult {
  s: number;
  z: number;
  pValue: number;
  /** Pente de Sen (unités par pas de temps). */
  senSlope: number;
  trend: "hausse" | "baisse" | "aucune";
}

/** Test de tendance de Mann-Kendall (avec correction des ex æquo) et pente de Sen. */
export function mannKendall(x: number[], alpha = 0.05): MannKendallResult {
  const n = x.length;
  let s = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(x[j] - x[i]);
      slopes.push((x[j] - x[i]) / (j - i));
    }
  }
  const counts = new Map<number, number>();
  for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) tieTerm += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  const senSlope = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
  return { s, z, pValue, senSlope, trend: pValue < alpha ? (z > 0 ? "hausse" : "baisse") : "aucune" };
}

export interface PettittResult {
  /** Indice (0-based) du dernier élément avant la rupture probable. */
  changeIndex: number;
  statistic: number;
  pValue: number;
}

/** Test de rupture de Pettitt (p-value approchée : 2·exp(-6K²/(n³+n²))). */
export function pettitt(x: number[]): PettittResult {
  const n = x.length;
  let best = 0;
  let bestIdx = 0;
  for (let t = 0; t < n - 1; t++) {
    let u = 0;
    for (let i = 0; i <= t; i++) for (let j = t + 1; j < n; j++) u += Math.sign(x[j] - x[i]);
    if (Math.abs(u) > best) {
      best = Math.abs(u);
      bestIdx = t;
    }
  }
  const pValue = Math.min(1, 2 * Math.exp((-6 * best * best) / (n ** 3 + n ** 2)));
  return { changeIndex: bestIdx, statistic: best, pValue };
}
