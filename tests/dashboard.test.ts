import { describe, expect, it } from "vitest";
import { dashboardKpis, summarizeDatasets } from "../src/lib/dashboard";
import { TEST_DATASET, type StoredDataset } from "../src/lib/dataset";

function ds(name: string, maxima: number[], extra: Partial<StoredDataset> = {}): StoredDataset {
  return {
    id: name,
    name,
    kind: "Pluie",
    unit: "mm",
    fileName: "x.csv",
    importedAt: "2026-01-01T00:00:00Z",
    start: "1990-01-01",
    end: `${1990 + maxima.length - 1}-12-31`,
    validDays: maxima.length * 365,
    minCompleteness: 0.8,
    annual: maxima.map((max, i) => ({ year: 1990 + i, max, completeness: 1, included: true, dateOfMax: `${1990 + i}-06-15` })),
    warnings: [],
    ...extra,
  };
}

const calm = [60, 72, 55, 80, 66, 91, 70, 58, 85, 77, 63, 69, 74, 88, 61];

describe("tableau de bord à partir des séries importées", () => {
  it("ignore la série fictive et marque critique une station dont le dernier maximum dépasse T = 50 ans", () => {
    const quiet = ds("Calme", calm);
    const hot = ds("Ouando", [...calm.slice(0, -1), 400], { lat: 6.52, lng: 2.61 });
    const list = summarizeDatasets([TEST_DATASET, quiet, hot]);
    expect(list.map((s) => s.name)).toEqual(["Calme", "Ouando"]);
    expect(list[0].status).toBe("active");
    expect(list[1].status).toBe("critical");
    expect(list[1].ratio).toBeGreaterThan(1);
    expect(list[0].threshold).toBeGreaterThan(100);

    const k = dashboardKpis(list);
    expect(k.count).toBe(2);
    expect(k.withPosition).toBe(1);
    expect(k.critical?.name).toBe("Ouando");
    expect(k.record).toMatchObject({ name: "Ouando", recordMax: 400, recordYear: 2004, recordDate: "2004-06-15" });
  });

  it("série trop courte : pas d'évaluation du seuil, station non critique", () => {
    const [s] = summarizeDatasets([ds("Courte", [50, 60, 70, 80])]);
    expect(s.threshold).toBeNull();
    expect(s.status).toBe("active");
  });
});
