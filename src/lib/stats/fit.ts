import { gamma } from "./special";
import type { Params } from "./distributions";

export const EULER_GAMMA = 0.5772156649015329;

export function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / x.length;
}

/** Variance d'échantillon (dénominateur n - ddof). */
export function variance(x: number[], ddof = 1): number {
  const m = mean(x);
  return x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - ddof);
}

export function std(x: number[], ddof = 1): number {
  return Math.sqrt(variance(x, ddof));
}

/** Asymétrie d'échantillon corrigée du biais : n/((n-1)(n-2)) · Σ(x-m)³ / s³ (s avec ddof = 1). */
export function skewness(x: number[]): number {
  const n = x.length;
  const m = mean(x);
  const s = std(x, 1);
  const sum3 = x.reduce((a, b) => a + (b - m) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * (sum3 / s ** 3);
}

/** L-moments d'échantillon l1, l2 et rapport t3 = l3/l2 (estimateurs sans biais, Hosking 1990). */
export function lMoments(sample: number[]): { l1: number; l2: number; l3: number; t3: number } {
  const x = [...sample].sort((a, b) => a - b);
  const n = x.length;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const r = i + 1; // rang
    b0 += x[i];
    b1 += ((r - 1) / (n - 1)) * x[i];
    b2 += (((r - 1) * (r - 2)) / ((n - 1) * (n - 2))) * x[i];
  }
  b0 /= n;
  b1 /= n;
  b2 /= n;
  const l1 = b0;
  const l2 = 2 * b1 - b0;
  const l3 = 6 * b2 - 6 * b1 + b0;
  return { l1, l2, l3, t3: l3 / l2 };
}

export type GumbelMethod = "mom" | "lmom" | "mle";
export type GevMethod = "lmom";

export function assertSample(x: number[], min = 5) {
  if (x.length < min) throw new Error(`Échantillon trop petit (${x.length} < ${min}).`);
  if (x.some((v) => !Number.isFinite(v))) throw new Error("L'échantillon contient des valeurs non numériques.");
}

export function fitGumbel(x: number[], method: GumbelMethod = "mle"): Params {
  assertSample(x);
  if (method === "mom") {
    const beta = (std(x, 1) * Math.sqrt(6)) / Math.PI;
    return [mean(x) - EULER_GAMMA * beta, beta];
  }
  if (method === "lmom") {
    const { l1, l2 } = lMoments(x);
    const beta = l2 / Math.LN2;
    return [l1 - EULER_GAMMA * beta, beta];
  }
  // Maximum de vraisemblance : β = x̄ - Σ x e^{-x/β} / Σ e^{-x/β}, résolu par Newton depuis les moments.
  const xbar = mean(x);
  const xs = x.map((v) => v - xbar); // centrage pour la stabilité numérique
  let beta = (std(x, 1) * Math.sqrt(6)) / Math.PI;
  const g = (b: number) => {
    let s0 = 0;
    let s1 = 0;
    for (const v of xs) {
      const e = Math.exp(-v / b);
      s0 += e;
      s1 += v * e;
    }
    return { value: b - (0 - s1 / s0), s0, s1 }; // xs est centré : x̄ = 0
  };
  for (let i = 0; i < 100; i++) {
    const h = 1e-7 * beta;
    const f = g(beta).value;
    const df = (g(beta + h).value - g(beta - h).value) / (2 * h);
    const next = beta - f / df;
    if (!(next > 0)) {
      beta /= 2;
      continue;
    }
    if (Math.abs(next - beta) < 1e-13 * beta) {
      beta = next;
      break;
    }
    beta = next;
  }
  // μ = -β ln(moyenne de e^{-x/β}) ; avec x centré, cela donne x̄ - β ln(s0/n).
  const { s0 } = g(beta);
  return [xbar - beta * Math.log(s0 / xs.length), beta];
}

/** GEV par L-moments (approximation de Hosking, Wallis & Wood 1985). Renvoie [μ, σ, ξ] avec ξ = -k. */
export function fitGev(x: number[]): Params {
  assertSample(x);
  const { l1, l2, t3 } = lMoments(x);
  const c = 2 / (3 + t3) - Math.LN2 / Math.log(3);
  const k = 7.859 * c + 2.9554 * c * c;
  if (Math.abs(k) < 1e-6) {
    const beta = l2 / Math.LN2;
    return [l1 - EULER_GAMMA * beta, beta, 0];
  }
  const g1 = gamma(1 + k);
  const sigma = (l2 * k) / ((1 - Math.pow(2, -k)) * g1);
  const mu = l1 + (sigma * (g1 - 1)) / k;
  return [mu, sigma, -k];
}

function logs(x: number[]): number[] {
  if (x.some((v) => v <= 0)) throw new Error("Les lois log exigent des valeurs strictement positives.");
  return x.map(Math.log);
}

/** Log-normale : μ et σ de ln X par maximum de vraisemblance (σ avec dénominateur n). */
export function fitLogNormal(x: number[]): Params {
  assertSample(x);
  const y = logs(x);
  return [mean(y), std(y, 0)];
}

/** Log-Pearson III : méthode des moments sur ln X (asymétrie corrigée du biais). */
export function fitLogPearson3(x: number[]): Params {
  assertSample(x);
  const y = logs(x);
  return [mean(y), std(y, 1), skewness(y)];
}
