import { describe, expect, it } from "vitest";
import { monthlyMaxima, parseCsv, parseDateCell, rowsToDaily } from "../src/lib/import-parse";
import { extractAnnualMaxima } from "../src/lib/stats";

describe("lecture CSV", () => {
  it("détecte le point-virgule, les virgules décimales et l'en-tête", () => {
    const rows = parseCsv("Date;Valeur\n01/01/2020;12,5\n02/01/2020;0\n03/01/2020;\n");
    expect(rows).toHaveLength(4);
    const { records, quality } = rowsToDaily(rows);
    expect(records).toEqual([
      { date: "2020-01-01", value: 12.5 },
      { date: "2020-01-02", value: 0 },
      { date: "2020-01-03", value: null },
    ]);
    expect(quality.validValues).toBe(2);
    expect(quality.missingValues).toBe(1);
  });

  it("gère BOM, guillemets et séparateur virgule", () => {
    const rows = parseCsv('﻿date,pluie\n"2021-05-01","3.2"\n2021-05-02,8\n');
    const { records } = rowsToDaily(rows);
    expect(records.map((r) => r.value)).toEqual([3.2, 8]);
  });

  it("fonctionne sans en-tête", () => {
    const { records } = rowsToDaily(parseCsv("2020-03-01,5\n2020-03-02,7\n"));
    expect(records).toHaveLength(2);
  });
});

describe("contrôle qualité", () => {
  it("signale dates illisibles, doublons, négatifs, codes de lacune et valeurs suspectes", () => {
    const { records, quality } = rowsToDaily(
      parseCsv(
        [
          "Date;Valeur",
          "01/01/2020;10",
          "01/01/2020;10", // doublon identique
          "02/01/2020;5",
          "02/01/2020;9", // doublon conflictuel
          "31/02/2020;4", // date impossible
          "pas une date;4",
          "03/01/2020;-9999", // code de lacune
          "04/01/2020;-3", // négatif
          "05/01/2020;420", // suspect
          "08/01/2020;1", // 06 et 07 absents
          "09/01/2020;abc", // texte
        ].join("\n"),
      ),
    );
    expect(quality.badDateRows).toEqual([6, 7]);
    expect(quality.duplicateDates).toBe(2);
    expect(quality.conflictingDuplicates).toBe(1);
    expect(quality.missingCodes).toBe(1);
    expect(quality.negativeValues).toBe(1);
    expect(quality.suspectValues).toEqual([{ date: "2020-01-05", value: 420 }]);
    expect(quality.absentDays).toBe(2);
    expect(quality.invalidValues).toBe(1);
    expect(quality.start).toBe("2020-01-01");
    expect(quality.end).toBe("2020-01-09");
    expect(records.find((r) => r.date === "2020-01-02")!.value).toBe(5); // première valeur conservée
    expect(quality.warnings.length).toBeGreaterThanOrEqual(5);
  });
});

describe("dates", () => {
  it("accepte plusieurs formats et rejette les dates impossibles", () => {
    expect(parseDateCell("2020-02-29")).toBe("2020-02-29");
    expect(parseDateCell("29/02/2021")).toBeNull();
    expect(parseDateCell("5.3.2019")).toBe("2019-03-05");
    expect(parseDateCell(new Date(Date.UTC(2018, 6, 4)))).toBe("2018-07-04");
    expect(parseDateCell("hier")).toBeNull();
  });
});

describe("de l'import aux maxima annuels", () => {
  it("chaîne complète sur deux années", () => {
    const lines = ["Date;Valeur"];
    for (let d = 0; d < 366; d++) {
      const dt = new Date(Date.UTC(2020, 0, 1 + d));
      lines.push(`${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()};${d === 200 ? 91.4 : 2}`);
    }
    for (let d = 1; d <= 20; d++) lines.push(`${String(d).padStart(2, "0")}/03/2021;150`);
    const { records } = rowsToDaily(parseCsv(lines.join("\n")));
    const annual = extractAnnualMaxima(records);
    expect(annual[0]).toMatchObject({ year: 2020, max: 91.4, included: true });
    expect(annual[1]).toMatchObject({ year: 2021, max: 150, included: false }); // 20 jours seulement
    expect(monthlyMaxima(records)[0]).toEqual({ month: "2020-01", max: 2 });
  });
});
