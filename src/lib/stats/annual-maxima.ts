export interface DailyRecord {
  /** Date au format AAAA-MM-JJ. */
  date: string;
  /** Valeur journalière ; null si lacune. */
  value: number | null;
}

export interface AnnualMax {
  year: number;
  max: number | null;
  dateOfMax: string | null;
  validDays: number;
  expectedDays: number;
  completeness: number;
  /** Année retenue pour l'ajustement (complétude suffisante). */
  included: boolean;
}

export interface AnnualMaximaOptions {
  /** Mois de début de l'année hydrologique (1 = année civile). */
  startMonth?: number;
  /** Complétude minimale pour retenir une année (0 à 1). Défaut : 0,8. */
  minCompleteness?: number;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Extrait le maximum annuel de chaque année, avec un contrôle de complétude. */
export function extractAnnualMaxima(records: DailyRecord[], options: AnnualMaximaOptions = {}): AnnualMax[] {
  const startMonth = options.startMonth ?? 1;
  const minCompleteness = options.minCompleteness ?? 0.8;
  const byYear = new Map<number, { max: number | null; date: string | null; valid: number }>();

  for (const r of records) {
    const [y, m] = r.date.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    const key = m >= startMonth ? y : y - 1;
    const entry = byYear.get(key) ?? { max: null, date: null, valid: 0 };
    if (r.value !== null && Number.isFinite(r.value)) {
      entry.valid += 1;
      if (entry.max === null || r.value > entry.max) {
        entry.max = r.value;
        entry.date = r.date;
      }
    }
    byYear.set(key, entry);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, e]) => {
      const start = new Date(Date.UTC(year, startMonth - 1, 1));
      const end = new Date(Date.UTC(year + 1, startMonth - 1, 1));
      const expectedDays = daysBetween(start, end);
      const completeness = e.valid / expectedDays;
      return {
        year,
        max: e.max,
        dateOfMax: e.date,
        validDays: e.valid,
        expectedDays,
        completeness,
        included: e.max !== null && completeness >= minCompleteness,
      };
    });
}
