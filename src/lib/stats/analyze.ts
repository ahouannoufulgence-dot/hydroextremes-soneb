import { DISTRIBUTIONS, returnLevel, type Distribution, type Params } from "./distributions";
import { fitGev, fitGumbel, fitLogNormal, fitLogPearson3, mean, skewness, std, type GumbelMethod } from "./fit";
import { informationCriteria, ksTest, type InformationCriteria, type KsResult } from "./gof";
import { bootstrapQuantileIntervals } from "./bootstrap";

export const DEFAULT_PERIODS = [10, 50, 100, 200];

export interface AnalysisOptions {
  periods?: number[];
  gumbelMethod?: GumbelMethod;
  bootstrapReplicates?: number;
  confidenceLevel?: number;
  seed?: number;
}

export interface QuantileResult {
  period: number;
  value: number;
  lower: number;
  upper: number;
}

export interface DistributionResult {
  id: Distribution["id"];
  label: string;
  method: string;
  paramNames: string[];
  params: Params;
  ks: KsResult;
  criteria: InformationCriteria;
  quantiles: QuantileResult[];
  /** Rang selon l'AICc (1 = meilleure loi). */
  rank: number;
}

export interface Analysis {
  n: number;
  summary: { mean: number; std: number; skewness: number; min: number; max: number };
  confidenceLevel: number;
  results: DistributionResult[];
  /** Points empiriques (position de traçage de Weibull : i/(n+1)). */
  empirical: { value: number; probability: number; returnPeriod: number }[];
}

export function weibullPositions(sample: number[]) {
  const n = sample.length;
  return [...sample]
    .sort((a, b) => a - b)
    .map((value, i) => {
      const probability = (i + 1) / (n + 1);
      return { value, probability, returnPeriod: 1 / (1 - probability) };
    });
}

/** Ajuste les quatre lois aux maxima annuels, teste l'adéquation et calcule les quantiles. */
export function analyzeAnnualMaxima(sample: number[], options: AnalysisOptions = {}): Analysis {
  const periods = options.periods ?? DEFAULT_PERIODS;
  const gumbelMethod = options.gumbelMethod ?? "mle";
  const level = options.confidenceLevel ?? 0.95;

  const fitters: Record<Distribution["id"], { fit: (x: number[]) => Params; method: string }> = {
    gumbel: { fit: (x) => fitGumbel(x, gumbelMethod), method: { mle: "Max. de vraisemblance", mom: "Moments", lmom: "L-moments" }[gumbelMethod] },
    gev: { fit: fitGev, method: "L-moments" },
    lognormal: { fit: fitLogNormal, method: "Max. de vraisemblance" },
    lp3: { fit: fitLogPearson3, method: "Moments (sur ln X)" },
  };

  const results: DistributionResult[] = DISTRIBUTIONS.map((dist) => {
    const { fit, method } = fitters[dist.id];
    const params = fit(sample);
    const intervals = bootstrapQuantileIntervals(dist, params, sample.length, fit, periods, {
      replicates: options.bootstrapReplicates,
      level,
      seed: options.seed,
    });
    return {
      id: dist.id,
      label: dist.label,
      method,
      paramNames: dist.paramNames,
      params,
      ks: ksTest(sample, dist, params),
      criteria: informationCriteria(sample, dist, params),
      quantiles: periods.map((period) => ({
        period,
        value: returnLevel(dist, params, period),
        lower: intervals.get(period)!.lower,
        upper: intervals.get(period)!.upper,
      })),
      rank: 0,
    };
  });

  [...results]
    .sort((a, b) => a.criteria.aicc - b.criteria.aicc)
    .forEach((r, i) => {
      r.rank = i + 1;
    });

  return {
    n: sample.length,
    summary: {
      mean: mean(sample),
      std: std(sample),
      skewness: skewness(sample),
      min: Math.min(...sample),
      max: Math.max(...sample),
    },
    confidenceLevel: level,
    results,
    empirical: weibullPositions(sample),
  };
}
