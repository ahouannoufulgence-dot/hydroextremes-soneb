import type { Distribution, Params } from "./distributions";
import { returnLevel } from "./distributions";
import { mulberry32, uniformOpen } from "./rng";

export interface Interval {
  lower: number;
  upper: number;
  /** Nombre de rééchantillons valides utilisés. */
  replicates: number;
}

/**
 * Intervalles de confiance des quantiles par bootstrap paramétrique :
 * on simule B échantillons de même taille depuis la loi ajustée, on réajuste
 * la même loi avec la même méthode, puis on prend les percentiles des quantiles.
 * Reproductible grâce à la graine.
 */
export function bootstrapQuantileIntervals(
  dist: Distribution,
  params: Params,
  n: number,
  refit: (sample: number[]) => Params,
  periods: number[],
  options: { replicates?: number; level?: number; seed?: number } = {},
): Map<number, Interval> {
  const B = options.replicates ?? 1000;
  const level = options.level ?? 0.95;
  const rng = mulberry32(options.seed ?? 12345);
  const draws = new Map<number, number[]>(periods.map((t) => [t, []]));

  for (let b = 0; b < B; b++) {
    const sample = Array.from({ length: n }, () => dist.ppf(uniformOpen(rng), params));
    let fitted: Params;
    try {
      fitted = refit(sample);
    } catch {
      continue;
    }
    const levels = periods.map((t) => returnLevel(dist, fitted, t));
    if (levels.some((v) => !Number.isFinite(v))) continue;
    periods.forEach((t, i) => draws.get(t)!.push(levels[i]));
  }

  const out = new Map<number, Interval>();
  const lo = (1 - level) / 2;
  for (const [t, values] of draws) {
    values.sort((a, b) => a - b);
    const q = (p: number) => values[Math.min(values.length - 1, Math.max(0, Math.round(p * (values.length - 1))))];
    out.set(t, values.length ? { lower: q(lo), upper: q(1 - lo), replicates: values.length } : { lower: NaN, upper: NaN, replicates: 0 });
  }
  return out;
}
