"use client";

import { useMemo } from "react";
import { MIN_YEARS_FOR_ANALYSIS, datasetLabel, datasetSeries, type StoredDataset } from "@/lib/dataset";
import { useDatasets } from "@/lib/dataset-store";
import { analyzeAnnualMaxima, mannKendall, pettitt } from "@/lib/stats";

/** Série active (importée ou fictive) et son analyse, calculée dans le navigateur. */
export function useActiveAnalysis(periods: number[]) {
  const { active } = useDatasets();
  const key = periods.join(",");

  return useMemo(() => {
    const series = datasetSeries(active);
    const base = { dataset: active as StoredDataset, series, label: datasetLabel(active) };
    if (series.length < MIN_YEARS_FOR_ANALYSIS) {
      return {
        ...base,
        analysis: null,
        error: `Seulement ${series.length} année(s) exploitable(s) : il en faut au moins ${MIN_YEARS_FOR_ANALYSIS} pour ajuster une loi. Importez une série plus longue ou abaissez la complétude minimale.`,
      };
    }
    try {
      const values = series.map((s) => s.max);
      return {
        ...base,
        analysis: analyzeAnnualMaxima(values, { periods: key.split(",").map(Number) }),
        mannKendall: mannKendall(values),
        pettitt: pettitt(values),
        error: null,
      };
    } catch (e) {
      return { ...base, analysis: null, error: e instanceof Error ? e.message : "Analyse impossible sur cette série." };
    }
  }, [active, key]);
}
