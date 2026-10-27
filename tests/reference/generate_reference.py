"""
Génère les valeurs de référence SciPy utilisées par tests/stats.test.ts.

Usage :  python3 -I tests/reference/generate_reference.py
Sortie : tests/reference/scipy-reference.json

Le moteur TypeScript est validé en comparant ses résultats à ces valeurs.
"""
import json
import math
from pathlib import Path

import numpy as np
import scipy
from scipy import special, stats

OUT = Path(__file__).parent / "scipy-reference.json"
PERIODS = [10, 50, 100, 200]
rng = np.random.default_rng(42)

# Échantillon fictif de 40 maxima annuels (mm), loi de Gumbel connue (mu=60, beta=18).
sample = np.round(stats.gumbel_r.rvs(loc=60, scale=18, size=40, random_state=rng), 1)
n = len(sample)

ref = {"meta": {"scipy": scipy.__version__, "numpy": np.__version__, "periods": PERIODS}}

# 1. Fonctions spéciales
xs = [0.001, 0.1, 0.5, 1.0, 2.5, 7.0, 25.0, 150.0]
alphas = [0.5, 1.0, 2.3, 10.0, 400.0, 1600.0]
ref["lngamma"] = [{"x": x, "y": float(special.gammaln(x))} for x in xs]
ref["gammap"] = [
    {"a": a, "x": x, "y": float(special.gammainc(a, x))}
    for a in alphas
    for x in [0.3 * a, 0.9 * a, a, 1.1 * a, 1.5 * a]
]
ref["gammapinv"] = [
    {"a": a, "p": p, "y": float(special.gammaincinv(a, p))}
    for a in alphas
    for p in [0.01, 0.1, 0.5, 0.9, 0.99, 0.995]
]
ref["normcdf"] = [{"x": x, "y": float(stats.norm.cdf(x))} for x in [-8, -4, -1.5, 0, 0.3, 2, 5]]
ref["normppf"] = [{"p": p, "y": float(stats.norm.ppf(p))} for p in [1e-8, 0.001, 0.02, 0.3, 0.5, 0.9, 0.995, 1 - 1e-9]]

# 2. Fonctions des lois (paramètres choisis)
probs = [0.01, 0.1, 0.5, 0.9, 0.98, 0.995]
xgrid = [20.0, 45.0, 70.0, 110.0, 160.0]


def finite_or_none(v):
    """-inf (hors du support) est enregistré en null : JSON n'accepte pas Infinity."""
    v = float(v)
    return v if math.isfinite(v) else None


def dist_block(name, params, cdf, ppf, logpdf):
    return {
        "name": name,
        "params": params,
        "cdf": [{"x": x, "y": float(cdf(x))} for x in xgrid],
        "ppf": [{"p": p, "y": float(ppf(p))} for p in probs],
        "logpdf": [{"x": x, "y": finite_or_none(logpdf(x))} for x in xgrid],
    }


mu, beta = 60.0, 18.0
ref["dist"] = {
    "gumbel": dist_block(
        "gumbel", [mu, beta],
        lambda x: stats.gumbel_r.cdf(x, mu, beta),
        lambda p: stats.gumbel_r.ppf(p, mu, beta),
        lambda x: stats.gumbel_r.logpdf(x, mu, beta),
    )
}
for key, (m_, s_, xi) in {"gev_pos": (60.0, 18.0, 0.15), "gev_neg": (60.0, 18.0, -0.2)}.items():
    ref["dist"][key] = dist_block(
        "gev", [m_, s_, xi],
        lambda x, m_=m_, s_=s_, xi=xi: stats.genextreme.cdf(x, -xi, m_, s_),
        lambda p, m_=m_, s_=s_, xi=xi: stats.genextreme.ppf(p, -xi, m_, s_),
        lambda x, m_=m_, s_=s_, xi=xi: stats.genextreme.logpdf(x, -xi, m_, s_),
    )
lmu, lsig = 4.1, 0.35
ref["dist"]["lognormal"] = dist_block(
    "lognormal", [lmu, lsig],
    lambda x: stats.lognorm.cdf(x, lsig, scale=math.exp(lmu)),
    lambda p: stats.lognorm.ppf(p, lsig, scale=math.exp(lmu)),
    lambda x: stats.lognorm.logpdf(x, lsig, scale=math.exp(lmu)),
)
for key, g in {"lp3_pos": 0.6, "lp3_neg": -0.5, "lp3_big_alpha": 0.08}.items():
    m_, s_ = 4.1, 0.3
    ref["dist"][key] = dist_block(
        "lp3", [m_, s_, g],
        lambda x, g=g, m_=m_, s_=s_: stats.pearson3.cdf(math.log(x), g, loc=m_, scale=s_),
        lambda p, g=g, m_=m_, s_=s_: math.exp(stats.pearson3.ppf(p, g, loc=m_, scale=s_)),
        lambda x, g=g, m_=m_, s_=s_: stats.pearson3.logpdf(math.log(x), g, loc=m_, scale=s_) - math.log(x),
    )

# 3. Estimateurs sur l'échantillon
ref["sample"] = sample.tolist()
EULER = 0.5772156649015329


def lmoms(x):
    """L-moments via la définition par les moments pondérés b_r (calcul indépendant du TypeScript)."""
    x = np.sort(x)
    N = len(x)
    i = np.arange(1, N + 1)
    b0 = x.mean()
    b1 = np.sum((i - 1) / (N - 1) * x) / N
    b2 = np.sum((i - 1) * (i - 2) / ((N - 1) * (N - 2)) * x) / N
    return b0, 2 * b1 - b0, 6 * b2 - 6 * b1 + b0


l1, l2, l3 = lmoms(sample)
t3 = l3 / l2

est = {}
# Gumbel
loc_mle, scale_mle = stats.gumbel_r.fit(sample)
b_mom = sample.std(ddof=1) * math.sqrt(6) / math.pi
b_lm = l2 / math.log(2)
est["gumbel_mle"] = [float(loc_mle), float(scale_mle)]
est["gumbel_mom"] = [float(sample.mean() - EULER * b_mom), float(b_mom)]
est["gumbel_lmom"] = [float(l1 - EULER * b_lm), float(b_lm)]
# GEV (L-moments, Hosking et al. 1985)
c = 2 / (3 + t3) - math.log(2) / math.log(3)
k = 7.8590 * c + 2.9554 * c * c
sig = l2 * k / ((1 - 2 ** (-k)) * special.gamma(1 + k))
mu_g = l1 + sig * (special.gamma(1 + k) - 1) / k
est["gev_lmom"] = [float(mu_g), float(sig), float(-k)]
# Log-normale
ls, _, lscale = stats.lognorm.fit(sample, floc=0)
est["lognormal"] = [float(math.log(lscale)), float(ls)]
# Log-Pearson III (moments des logs, asymétrie corrigée)
y = np.log(sample)
est["lp3"] = [float(y.mean()), float(y.std(ddof=1)), float(stats.skew(y, bias=False))]
ref["estimates"] = est
ref["lmoments"] = {"l1": float(l1), "l2": float(l2), "l3": float(l3), "t3": float(t3)}

# 4. Quantiles de référence, log-vraisemblance, KS
T = np.array(PERIODS, dtype=float)
p = 1 - 1 / T
q, ll, ks = {}, {}, {}
g = est["gumbel_mle"]
q["gumbel_mle"] = stats.gumbel_r.ppf(p, g[0], g[1]).tolist()
ll["gumbel_mle"] = float(np.sum(stats.gumbel_r.logpdf(sample, g[0], g[1])))
ks["gumbel_mle"] = float(stats.kstest(sample, lambda v: stats.gumbel_r.cdf(v, g[0], g[1])).statistic)
e = est["gev_lmom"]
q["gev_lmom"] = stats.genextreme.ppf(p, -e[2], e[0], e[1]).tolist()
ll["gev_lmom"] = float(np.sum(stats.genextreme.logpdf(sample, -e[2], e[0], e[1])))
ks["gev_lmom"] = float(stats.kstest(sample, lambda v: stats.genextreme.cdf(v, -e[2], e[0], e[1])).statistic)
e = est["lognormal"]
q["lognormal"] = stats.lognorm.ppf(p, e[1], scale=math.exp(e[0])).tolist()
ll["lognormal"] = float(np.sum(stats.lognorm.logpdf(sample, e[1], scale=math.exp(e[0]))))
ks["lognormal"] = float(stats.kstest(sample, lambda v: stats.lognorm.cdf(v, e[1], scale=math.exp(e[0]))).statistic)
e = est["lp3"]
q["lp3"] = np.exp(stats.pearson3.ppf(p, e[2], loc=e[0], scale=e[1])).tolist()
ll["lp3"] = float(np.sum(stats.pearson3.logpdf(np.log(sample), e[2], loc=e[0], scale=e[1]) - np.log(sample)))
ks["lp3"] = float(stats.kstest(np.log(sample), lambda v: stats.pearson3.cdf(v, e[2], loc=e[0], scale=e[1])).statistic)
ref["quantiles"], ref["loglik"], ref["ks_statistic"] = q, ll, ks

# 5. Tendance : série avec une dérive nette + bruit
trend = np.round(40 + 0.8 * np.arange(30) + np.random.default_rng(7).normal(0, 6, 30), 1)
S = 0
for i in range(len(trend) - 1):
    S += int(np.sum(np.sign(trend[i + 1:] - trend[i])))
m = len(trend)
tie_counts = np.unique(trend, return_counts=True)[1]
varS = (m * (m - 1) * (2 * m + 5) - sum(t * (t - 1) * (2 * t + 5) for t in tie_counts)) / 18  # avec correction des ex æquo
z = (S - 1) / math.sqrt(varS) if S > 0 else (S + 1) / math.sqrt(varS) if S < 0 else 0.0
sen = stats.theilslopes(trend)[0]
ref["trend"] = {
    "series": trend.tolist(),
    "S": S,
    "z": z,
    "p": float(2 * (1 - stats.norm.cdf(abs(z)))),
    "sen": float(sen),
    # S retrouvé depuis le tau-b de SciPy (tient compte des ex æquo de la série) : S = tau_b * sqrt(n0 * (n0 - n2))
    "kendall_tau_check": float(
        stats.kendalltau(np.arange(m), trend).statistic
        * math.sqrt((m * (m - 1) / 2) * ((m * (m - 1) / 2) - sum(t * (t - 1) / 2 for t in np.unique(trend, return_counts=True)[1])))
    ),
}

OUT.write_text(json.dumps(ref, indent=1))
print("écrit", OUT, "- échantillon n =", n)
