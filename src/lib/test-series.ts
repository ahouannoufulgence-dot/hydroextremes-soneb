import { gumbel, mulberry32, uniformOpen } from "@/lib/stats";

/**
 * SÉRIE FICTIVE de maxima annuels de pluie journalière (mm), 1985-2024.
 * Générée avec une loi de Gumbel connue (μ = 60 mm, β = 18 mm) : on connaît
 * donc la « vraie » réponse et on peut vérifier que le moteur la retrouve.
 * À remplacer par les maxima annuels extraits des données réelles de la SONEB.
 */
export const TEST_SERIES_TRUTH = { law: "Gumbel", mu: 60, beta: 18 } as const;

const rng = mulberry32(20240524);

export const TEST_ANNUAL_MAXIMA: { year: number; max: number }[] = Array.from({ length: 40 }, (_, i) => ({
  year: 1985 + i,
  max: Math.round(gumbel.ppf(uniformOpen(rng), [TEST_SERIES_TRUTH.mu, TEST_SERIES_TRUTH.beta]) * 10) / 10,
}));

export const TEST_STATION_LABEL = "Série fictive (40 ans, loi vraie : Gumbel, mu = 60, beta = 18)";
