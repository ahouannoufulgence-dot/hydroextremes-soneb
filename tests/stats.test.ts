import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DISTRIBUTIONS,
  analyzeAnnualMaxima,
  bootstrapQuantileIntervals,
  extractAnnualMaxima,
  fitGev,
  fitGumbel,
  fitLogNormal,
  fitLogPearson3,
  gammaP,
  gammaPInv,
  gev,
  gumbel,
  informationCriteria,
  ksTest,
  lMoments,
  lnGamma,
  logNormal,
  logPearson3,
  mannKendall,
  mulberry32,
  normalCdf,
  normalPpf,
  pettitt,
  returnLevel,
  uniformOpen,
} from "../src/lib/stats";

const ref: any = JSON.parse(readFileSync(new URL("./reference/scipy-reference.json", import.meta.url), "utf8"));

/** Écart relatif (absolu si la référence est proche de 0). */
function relErr(a: number, b: number) {
  return Math.abs(a - b) / Math.max(1, Math.abs(b));
}
function expectClose(actual: number, expected: number, tol: number, label = "") {
  expect(relErr(actual, expected), `${label} obtenu=${actual} attendu=${expected}`).toBeLessThan(tol);
}

describe("fonctions spéciales vs SciPy", () => {
  it("ln Γ", () => ref.lngamma.forEach((r: any) => expectClose(lnGamma(r.x), r.y, 1e-12, `lnΓ(${r.x})`)));
  it("gamma incomplète P(a,x)", () =>
    ref.gammap.forEach((r: any) => expectClose(gammaP(r.a, r.x), r.y, 1e-10, `P(${r.a},${r.x})`)));
  it("inverse de la gamma incomplète", () =>
    ref.gammapinv.forEach((r: any) => expectClose(gammaPInv(r.a, r.p), r.y, 1e-9, `P⁻¹(${r.a},${r.p})`)));
  it("loi normale : cdf et quantile", () => {
    ref.normcdf.forEach((r: any) => expectClose(normalCdf(r.x), r.y, 1e-12, `Φ(${r.x})`));
    ref.normppf.forEach((r: any) => expectClose(normalPpf(r.p), r.y, 1e-9, `Φ⁻¹(${r.p})`));
  });
});

const byName: Record<string, typeof gumbel> = { gumbel, gev, lognormal: logNormal, lp3: logPearson3 };

describe("fonctions des lois vs SciPy", () => {
  for (const [key, block] of Object.entries<any>(ref.dist)) {
    const dist = byName[block.name];
    it(`${key} : cdf, quantile, log-densité`, () => {
      block.cdf.forEach((r: any) => expectClose(dist.cdf(r.x, block.params), r.y, 1e-9, `${key} cdf(${r.x})`));
      block.ppf.forEach((r: any) => expectClose(dist.ppf(r.p, block.params), r.y, 1e-8, `${key} ppf(${r.p})`));
      block.logpdf.forEach((r: any) => (r.y === null ? expect(dist.logpdf(r.x, block.params)).toBe(-Infinity) : expectClose(dist.logpdf(r.x, block.params), r.y, 1e-9, `${key} logpdf(${r.x})`)));
    });
  }
});

describe("estimation des paramètres vs SciPy / calcul indépendant", () => {
  const sample: number[] = ref.sample;
  const e = ref.estimates;
  const all = (a: number[], b: number[], tol: number, label: string) =>
    b.forEach((v, i) => expectClose(a[i], v, tol, `${label}[${i}]`));

  it("L-moments", () => {
    const l = lMoments(sample);
    for (const k of ["l1", "l2", "l3", "t3"] as const) expectClose(l[k], ref.lmoments[k], 1e-12, k);
  });
  it("Gumbel : maximum de vraisemblance (scipy.stats.gumbel_r.fit)", () => all(fitGumbel(sample, "mle"), e.gumbel_mle, 1e-5, "mle"));
  it("Gumbel : moments", () => all(fitGumbel(sample, "mom"), e.gumbel_mom, 1e-12, "mom"));
  it("Gumbel : L-moments", () => all(fitGumbel(sample, "lmom"), e.gumbel_lmom, 1e-12, "lmom"));
  it("GEV : L-moments", () => all(fitGev(sample), e.gev_lmom, 1e-10, "gev"));
  it("Log-normale (scipy.stats.lognorm.fit)", () => all(fitLogNormal(sample), e.lognormal, 1e-6, "lognormal"));
  it("Log-Pearson III (moments des logs)", () => all(fitLogPearson3(sample), e.lp3, 1e-10, "lp3"));
});

describe("quantiles, vraisemblance et KS vs SciPy", () => {
  const sample: number[] = ref.sample;
  const cases: [string, (typeof DISTRIBUTIONS)[number], number[]][] = [
    ["gumbel_mle", gumbel, fitGumbel(sample, "mle")],
    ["gev_lmom", gev, fitGev(sample)],
    ["lognormal", logNormal, fitLogNormal(sample)],
    ["lp3", logPearson3, fitLogPearson3(sample)],
  ];
  for (const [key, dist, params] of cases) {
    it(key, () => {
      ref.meta.periods.forEach((T: number, i: number) =>
        expectClose(returnLevel(dist, params, T), ref.quantiles[key][i], 1e-5, `${key} T=${T}`),
      );
      const ic = informationCriteria(sample, dist, params);
      expectClose(ic.logLik, ref.loglik[key], 1e-6, `${key} logLik`);
      expectClose(ksTest(sample, dist, params).statistic, ref.ks_statistic[key], 1e-6, `${key} KS`);
    });
  }
});

describe("tendance", () => {
  const t = ref.trend;
  it("Mann-Kendall et pente de Sen", () => {
    const r = mannKendall(t.series);
    expect(r.s).toBe(t.S);
    expect(t.S).toBeCloseTo(t.kendall_tau_check, 6); // cohérence avec scipy.kendalltau
    expectClose(r.z, t.z, 1e-12, "Z");
    expectClose(r.pValue, t.p, 1e-9, "p");
    expectClose(r.senSlope, t.sen, 1e-12, "Sen");
    expect(r.trend).toBe("hausse");
  });
  it("Pettitt détecte une rupture nette", () => {
    const series = [...Array(20).fill(10), ...Array(20).fill(30)].map((v, i) => v + (i % 3) * 0.1);
    const r = pettitt(series);
    expect(r.changeIndex).toBe(19);
    expect(r.pValue).toBeLessThan(0.01);
  });
});

describe("propriétés du moteur", () => {
  it("retrouve les paramètres vrais d'une loi de Gumbel (grand échantillon)", () => {
    const rng = mulberry32(2024);
    const big = Array.from({ length: 5000 }, () => gumbel.ppf(uniformOpen(rng), [60, 18]));
    const [mu, beta] = fitGumbel(big, "mle");
    expect(Math.abs(mu - 60) / 60).toBeLessThan(0.02);
    expect(Math.abs(beta - 18) / 18).toBeLessThan(0.03);
    const [m2, s2, xi] = fitGev(big);
    expect(Math.abs(m2 - 60) / 60).toBeLessThan(0.03);
    expect(Math.abs(s2 - 18) / 18).toBeLessThan(0.05);
    expect(Math.abs(xi)).toBeLessThan(0.05);
  });

  it("ppf et cdf sont réciproques", () => {
    for (const dist of DISTRIBUTIONS) {
      const params = dist.id === "gumbel" ? [60, 18] : dist.id === "gev" ? [60, 18, 0.1] : dist.id === "lognormal" ? [4, 0.4] : [4, 0.4, 0.5];
      for (const p of [0.05, 0.5, 0.9, 0.995]) expectClose(dist.cdf(dist.ppf(p, params), params), p, 1e-9, `${dist.id} ${p}`);
    }
  });

  it("le bootstrap est reproductible et encadre l'estimation", () => {
    const sample: number[] = ref.sample;
    const params = fitGumbel(sample, "mle");
    const run = () => bootstrapQuantileIntervals(gumbel, params, sample.length, (x) => fitGumbel(x, "mle"), [10, 100], { replicates: 300, seed: 1 });
    const a = run();
    const b = run();
    expect(a.get(100)).toEqual(b.get(100));
    for (const T of [10, 100]) {
      const iv = a.get(T)!;
      const est = returnLevel(gumbel, params, T);
      expect(iv.lower).toBeLessThan(est);
      expect(iv.upper).toBeGreaterThan(est);
      expect(iv.replicates).toBeGreaterThan(290);
    }
  });

  it("analyzeAnnualMaxima : quantiles croissants avec T et rangs AICc cohérents", () => {
    const a = analyzeAnnualMaxima(ref.sample, { bootstrapReplicates: 200 });
    expect(a.results).toHaveLength(4);
    expect(a.results.map((r) => r.rank).sort()).toEqual([1, 2, 3, 4]);
    for (const r of a.results) {
      const v = r.quantiles.map((q) => q.value);
      expect([...v].sort((x, y) => x - y)).toEqual(v);
      r.quantiles.forEach((q) => {
        expect(q.lower).toBeLessThanOrEqual(q.upper);
      });
    }
  });
});

describe("extraction des maxima annuels", () => {
  it("retient le maximum, signale les années incomplètes", () => {
    const rec = [];
    for (let d = 1; d <= 365; d++) {
      const date = new Date(Date.UTC(2020, 0, d)).toISOString().slice(0, 10);
      rec.push({ date, value: d === 100 ? 87 : 5 });
    }
    // 2021 : seulement 30 jours renseignés
    for (let d = 1; d <= 30; d++) rec.push({ date: `2021-01-${String(d).padStart(2, "0")}`, value: 200 });
    const out = extractAnnualMaxima(rec);
    expect(out[0]).toMatchObject({ year: 2020, max: 87, included: true });
    expect(out[0].dateOfMax).toBe("2020-04-09");
    expect(out[1]).toMatchObject({ year: 2021, max: 200, included: false });
  });
});
