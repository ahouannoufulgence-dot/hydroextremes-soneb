import type { Distribution, Params } from "./distributions";

export interface KsResult {
  statistic: number;
  pValue: number;
}

/**
 * Test de Kolmogorov-Smirnov. La p-value utilise l'approximation asymptotique
 * (correction de Stephens). Comme les paramètres sont estimés sur le même échantillon,
 * la p-value est approximative (trop favorable à l'ajustement) : l'utiliser pour
 * comparer les lois entre elles plutôt que comme preuve absolue.
 */
export function ksTest(sample: number[], dist: Distribution, params: Params): KsResult {
  const x = [...sample].sort((a, b) => a - b);
  const n = x.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = dist.cdf(x[i], params);
    d = Math.max(d, (i + 1) / n - f, f - i / n);
  }
  const lambda = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * d;
  let p = 0;
  if (lambda < 0.2) {
    p = 1;
  } else {
    for (let j = 1; j <= 100; j++) {
      const term = 2 * (j % 2 === 1 ? 1 : -1) * Math.exp(-2 * j * j * lambda * lambda);
      p += term;
      if (Math.abs(term) < 1e-12) break;
    }
  }
  return { statistic: d, pValue: Math.min(1, Math.max(0, p)) };
}

export function logLikelihood(sample: number[], dist: Distribution, params: Params): number {
  return sample.reduce((acc, v) => acc + dist.logpdf(v, params), 0);
}

export interface InformationCriteria {
  logLik: number;
  aic: number;
  aicc: number;
  bic: number;
}

export function informationCriteria(sample: number[], dist: Distribution, params: Params): InformationCriteria {
  const n = sample.length;
  const k = params.length;
  const logLik = logLikelihood(sample, dist, params);
  const aic = 2 * k - 2 * logLik;
  const aicc = n - k - 1 > 0 ? aic + (2 * k * (k + 1)) / (n - k - 1) : Infinity;
  const bic = k * Math.log(n) - 2 * logLik;
  return { logLik, aic, aicc, bic };
}
