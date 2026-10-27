import { describe, expect, it } from "vitest";
import { annualMaximaCsv, quantilesCsv } from "../src/lib/export-csv";
import { TEST_DATASET } from "../src/lib/dataset";
import { analyzeAnnualMaxima } from "../src/lib/stats";

describe("exports CSV", () => {
  const values = TEST_DATASET.annual.map((a) => a.max as number);
  const analysis = analyzeAnnualMaxima(values, { periods: [10, 100], bootstrapReplicates: 100 });

  it("quantiles : séparateur ; virgule décimale, BOM, une ligne par loi et période", () => {
    const csv = quantilesCsv(analysis, "mm");
    const lines = csv.trim().split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toContain("periode_de_retour_ans;valeur_mm;ic95_bas;ic95_haut");
    expect(lines).toHaveLength(1 + 4 * 2);
    expect(lines[1].split(";")).toHaveLength(7);
    expect(lines[1]).toMatch(/;\d+,\d+;/); // virgule décimale
  });

  it("maxima annuels : une ligne par année avec statut", () => {
    const lines = annualMaximaCsv(TEST_DATASET).trim().split("\r\n");
    expect(lines).toHaveLength(1 + TEST_DATASET.annual.length);
    expect(lines[1].endsWith(";oui")).toBe(true);
  });
});
