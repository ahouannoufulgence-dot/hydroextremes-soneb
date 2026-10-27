import { gammaP, gammaPInv, lnGamma, normalCdf, normalPpf } from "./special";

export type Params = number[];

export interface Distribution {
  id: "gumbel" | "gev" | "lognormal" | "lp3";
  label: string;
  paramNames: string[];
  /** Fonction de répartition F(x) = P(X ≤ x). */
  cdf(x: number, p: Params): number;
  /** Quantile : x tel que F(x) = prob. */
  ppf(prob: number, p: Params): number;
  /** ln f(x) ; -Infinity hors du support. */
  logpdf(x: number, p: Params): number;
}

const SHAPE_EPS = 1e-8;

/** Gumbel (extrême de type I) : paramètres [μ position, β échelle]. */
export const gumbel: Distribution = {
  id: "gumbel",
  label: "Gumbel",
  paramNames: ["μ", "β"],
  cdf: (x, [mu, beta]) => Math.exp(-Math.exp(-(x - mu) / beta)),
  ppf: (prob, [mu, beta]) => mu - beta * Math.log(-Math.log(prob)),
  logpdf: (x, [mu, beta]) => {
    const z = (x - mu) / beta;
    return -Math.log(beta) - z - Math.exp(-z);
  },
};

/**
 * GEV : paramètres [μ position, σ échelle, ξ forme].
 * Convention : F(x) = exp(-(1 + ξ (x-μ)/σ)^(-1/ξ)) ; ξ > 0 = queue lourde (Fréchet).
 * (SciPy : c = -ξ.)
 */
export const gev: Distribution = {
  id: "gev",
  label: "GEV",
  paramNames: ["μ", "σ", "ξ"],
  cdf: (x, [mu, sigma, xi]) => {
    const z = (x - mu) / sigma;
    if (Math.abs(xi) < SHAPE_EPS) return Math.exp(-Math.exp(-z));
    const t = 1 + xi * z;
    if (t <= 0) return xi > 0 ? 0 : 1;
    return Math.exp(-Math.pow(t, -1 / xi));
  },
  ppf: (prob, [mu, sigma, xi]) => {
    const y = -Math.log(prob);
    if (Math.abs(xi) < SHAPE_EPS) return mu - sigma * Math.log(y);
    return mu + (sigma / xi) * (Math.pow(y, -xi) - 1);
  },
  logpdf: (x, [mu, sigma, xi]) => {
    const z = (x - mu) / sigma;
    if (Math.abs(xi) < SHAPE_EPS) return -Math.log(sigma) - z - Math.exp(-z);
    const t = 1 + xi * z;
    if (t <= 0) return -Infinity;
    return -Math.log(sigma) - (1 + 1 / xi) * Math.log(t) - Math.pow(t, -1 / xi);
  },
};

/** Log-normale à 2 paramètres : [μ, σ] = moyenne et écart-type de ln X. */
export const logNormal: Distribution = {
  id: "lognormal",
  label: "Log-normale",
  paramNames: ["μ(ln)", "σ(ln)"],
  cdf: (x, [mu, sigma]) => (x <= 0 ? 0 : normalCdf((Math.log(x) - mu) / sigma)),
  ppf: (prob, [mu, sigma]) => Math.exp(mu + sigma * normalPpf(prob)),
  logpdf: (x, [mu, sigma]) => {
    if (x <= 0) return -Infinity;
    const z = (Math.log(x) - mu) / sigma;
    return -Math.log(x) - Math.log(sigma) - 0.5 * Math.log(2 * Math.PI) - 0.5 * z * z;
  },
};

/**
 * Log-Pearson type III : paramètres [m, s, g] = moyenne, écart-type et
 * coefficient d'asymétrie de Y = ln X (Y suit une loi de Pearson III).
 * Pearson III : α = 4/g², β = s·g/2, τ = m - 2s/g, Y = τ + β·G avec G ~ Gamma(α).
 */
function pearson3(g: number, m: number, s: number) {
  return { alpha: 4 / (g * g), beta: (s * g) / 2, tau: m - (2 * s) / g };
}

const SKEW_EPS = 1e-6;

export const logPearson3: Distribution = {
  id: "lp3",
  label: "Log-Pearson III",
  paramNames: ["m(ln)", "s(ln)", "g(ln)"],
  cdf: (x, [m, s, g]) => {
    if (x <= 0) return 0;
    const y = Math.log(x);
    if (Math.abs(g) < SKEW_EPS) return normalCdf((y - m) / s);
    const { alpha, beta, tau } = pearson3(g, m, s);
    const u = (y - tau) / beta;
    if (g > 0) return u <= 0 ? 0 : gammaP(alpha, u);
    return u <= 0 ? 1 : 1 - gammaP(alpha, u);
  },
  ppf: (prob, [m, s, g]) => {
    if (Math.abs(g) < SKEW_EPS) return Math.exp(m + s * normalPpf(prob));
    const { alpha, beta, tau } = pearson3(g, m, s);
    const u = g > 0 ? gammaPInv(alpha, prob) : gammaPInv(alpha, 1 - prob);
    return Math.exp(tau + beta * u);
  },
  logpdf: (x, [m, s, g]) => {
    if (x <= 0) return -Infinity;
    const y = Math.log(x);
    if (Math.abs(g) < SKEW_EPS) {
      const z = (y - m) / s;
      return -y - Math.log(s) - 0.5 * Math.log(2 * Math.PI) - 0.5 * z * z;
    }
    const { alpha, beta, tau } = pearson3(g, m, s);
    const u = (y - tau) / beta;
    if (u <= 0) return -Infinity;
    return (alpha - 1) * Math.log(u) - u - lnGamma(alpha) - Math.log(Math.abs(beta)) - y;
  },
};

export const DISTRIBUTIONS: Distribution[] = [gumbel, gev, logNormal, logPearson3];

/** Quantile de période de retour T (années) pour des maxima annuels : F(x) = 1 - 1/T. */
export function returnLevel(dist: Distribution, params: Params, T: number): number {
  return dist.ppf(1 - 1 / T, params);
}
