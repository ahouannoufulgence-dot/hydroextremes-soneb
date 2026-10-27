import { TEST_ANNUAL_MAXIMA, TEST_STATION_LABEL } from "@/lib/test-series";

export type VariableKind = "Pluie" | "Débit";

export interface AnnualRow {
  year: number;
  max: number | null;
  /** Date du maximum (AAAA-MM-JJ), si connue. */
  dateOfMax?: string | null;
  completeness: number;
  included: boolean;
}

/** Jeu de données importé (seuls les maxima annuels et le bilan qualité sont conservés dans le navigateur). */
export interface StoredDataset {
  id: string;
  name: string;
  kind: VariableKind;
  unit: string;
  fileName: string;
  importedAt: string;
  start: string;
  end: string;
  validDays: number;
  minCompleteness: number;
  annual: AnnualRow[];
  warnings: string[];
  /** Position de la station (degrés décimaux), facultative. */
  lat?: number;
  lng?: number;
  isTest?: boolean;
}

export const MIN_YEARS_FOR_ANALYSIS = 10;

export const TEST_DATASET: StoredDataset = {
  id: "test",
  name: "Série fictive",
  kind: "Pluie",
  unit: "mm",
  fileName: "(générée par l'application)",
  importedAt: "",
  start: `${TEST_ANNUAL_MAXIMA[0].year}-01-01`,
  end: `${TEST_ANNUAL_MAXIMA[TEST_ANNUAL_MAXIMA.length - 1].year}-12-31`,
  validDays: TEST_ANNUAL_MAXIMA.length * 365,
  minCompleteness: 0.8,
  annual: TEST_ANNUAL_MAXIMA.map((d) => ({ year: d.year, max: d.max, completeness: 1, included: true })),
  warnings: [],
  isTest: true,
};

export const TEST_DATASET_LABEL = TEST_STATION_LABEL;

/** Maxima annuels retenus pour l'ajustement. */
export function datasetSeries(ds: StoredDataset): { year: number; max: number }[] {
  return ds.annual.filter((a) => a.included && a.max !== null).map((a) => ({ year: a.year, max: a.max as number }));
}

export function datasetLabel(ds: StoredDataset): string {
  return ds.isTest ? TEST_DATASET_LABEL : `${ds.name} (${ds.kind.toLowerCase()}, ${ds.start.slice(0, 4)}–${ds.end.slice(0, 4)})`;
}
