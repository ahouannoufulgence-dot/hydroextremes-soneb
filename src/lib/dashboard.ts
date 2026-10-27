import { datasetSeries, type StoredDataset, type VariableKind } from "@/lib/dataset";
import { analyzeAnnualMaxima } from "@/lib/stats";

export interface StationSummary {
  id: string;
  name: string;
  kind: VariableKind;
  unit: string;
  lat?: number;
  lng?: number;
  years: number;
  lastYear: number;
  /** Dernier maximum annuel retenu. */
  lastMax: number;
  /** Quantile T = 50 ans de la meilleure loi (AICc), null si l'ajustement est impossible. */
  threshold: number | null;
  /** lastMax / threshold. */
  ratio: number | null;
  status: "active" | "critical";
  recordMax: number;
  recordYear: number;
  recordDate: string | null;
}

export const ALERT_PERIOD = 50;
export const MIN_YEARS = 10;

/**
 * Résume chaque série importée. Une station est « critique » lorsque son dernier maximum
 * annuel atteint ou dépasse la valeur de période de retour 50 ans de la meilleure loi ajustée.
 */
export function summarizeDatasets(datasets: StoredDataset[]): StationSummary[] {
  const out: StationSummary[] = [];
  for (const ds of datasets) {
    if (ds.isTest) continue;
    const series = datasetSeries(ds);
    if (!series.length) continue;
    const last = series[series.length - 1];
    const record = series.reduce((a, b) => (b.max > a.max ? b : a));
    const recordRow = ds.annual.find((a) => a.year === record.year);

    let threshold: number | null = null;
    if (series.length >= MIN_YEARS) {
      try {
        const analysis = analyzeAnnualMaxima(
          series.map((s) => s.max),
          { periods: [ALERT_PERIOD], bootstrapReplicates: 0 },
        );
        const best = analysis.results.find((r) => r.rank === 1)!;
        const v = best.quantiles[0].value;
        threshold = Number.isFinite(v) ? v : null;
      } catch {
        threshold = null;
      }
    }
    const ratio = threshold ? last.max / threshold : null;
    out.push({
      id: ds.id,
      name: ds.name,
      kind: ds.kind,
      unit: ds.unit,
      lat: ds.lat,
      lng: ds.lng,
      years: series.length,
      lastYear: last.year,
      lastMax: last.max,
      threshold,
      ratio,
      status: ratio !== null && ratio >= 1 ? "critical" : "active",
      recordMax: record.max,
      recordYear: record.year,
      recordDate: recordRow?.dateOfMax ?? null,
    });
  }
  return out;
}

export function dashboardKpis(list: StationSummary[]) {
  const rain = list.filter((s) => s.kind === "Pluie");
  const record = rain.length ? rain.reduce((a, b) => (b.recordMax > a.recordMax ? b : a)) : null;
  const critical = list.filter((s) => s.status === "critical").sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0] ?? null;
  return {
    count: list.length,
    withPosition: list.filter((s) => s.lat !== undefined && s.lng !== undefined).length,
    rainCount: rain.length,
    flowCount: list.length - rain.length,
    record,
    critical,
  };
}
