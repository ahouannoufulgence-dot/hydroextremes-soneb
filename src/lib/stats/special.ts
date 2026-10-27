/**
 * Fonctions spéciales (gamma, loi normale) implémentées sans dépendance,
 * avec une précision proche de la double précision. Validées contre SciPy
 * dans tests/stats.test.ts.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** ln Γ(x) pour x > 0 (approximation de Lanczos, g = 7). */
export function lnGamma(x: number): number {
  if (x < 0.5) {
    // formule des compléments : Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

export function gamma(x: number): number {
  return Math.exp(lnGamma(x));
}

const EPS = 1e-16;
const TINY = 1e-300;

/** Fonction gamma incomplète régularisée supérieure Q(a, x) = 1 - P(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const front = Math.exp(-x + a * Math.log(x) - lnGamma(a));
  if (x < a + 1) {
    // série pour P, puis Q = 1 - P
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 100000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return 1 - sum * front;
  }
  // fraction continue (algorithme de Lentz) pour Q
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return front * h;
}

/** Fonction gamma incomplète régularisée inférieure P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    const front = Math.exp(-x + a * Math.log(x) - lnGamma(a));
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 100000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * front;
  }
  return 1 - gammaQ(a, x);
}

export function erfc(z: number): number {
  return z >= 0 ? gammaQ(0.5, z * z) : 2 - gammaQ(0.5, z * z);
}

export function normalCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Quantile de la loi normale centrée réduite (Acklam + un pas de raffinement). */
export function normalPpf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // raffinement de Halley
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Inverse de P(a, ·) : renvoie x tel que P(a, x) = p (Newton protégé par un encadrement). */
export function gammaPInv(a: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  const z = normalPpf(p);
  let x = a * Math.pow(1 - 1 / (9 * a) + z / (3 * Math.sqrt(a)), 3); // Wilson–Hilferty
  if (!(x > 0)) x = Math.exp((Math.log(p * a) + lnGamma(a)) / a) || 1e-8;

  let lo = 0;
  let hi = Math.max(x * 2, 1);
  while (gammaP(a, hi) < p) hi *= 2;

  for (let i = 0; i < 200; i++) {
    const f = gammaP(a, x) - p;
    if (f > 0) hi = x;
    else lo = x;
    const dens = Math.exp(-x + (a - 1) * Math.log(x) - lnGamma(a));
    let next = x - f / dens;
    if (!(next > lo && next < hi) || !Number.isFinite(next)) next = (lo + hi) / 2;
    if (Math.abs(next - x) <= 1e-14 * Math.max(1, next)) return next;
    x = next;
  }
  return x;
}
