import type { DailyRecord } from "@/lib/stats";

export type Cell = string | number | boolean | Date | null | undefined;

export interface QualityReport {
  rowsRead: number;
  /** Lignes ignorées car la date n'a pas pu être lue (numéro de ligne du fichier). */
  badDateRows: number[];
  validValues: number;
  missingValues: number;
  /** Valeurs conventionnelles de lacune (-99, -999, -9999) converties en lacunes. */
  missingCodes: number;
  negativeValues: number;
  /** Valeurs non numériques (texte) traitées comme lacunes. */
  invalidValues: number;
  duplicateDates: number;
  conflictingDuplicates: number;
  start: string | null;
  end: string | null;
  calendarDays: number;
  /** Jours du calendrier absents du fichier (aucune ligne). */
  absentDays: number;
  suspectThreshold: number;
  suspectValues: { date: string; value: number }[];
  maxValue: { date: string; value: number } | null;
  warnings: string[];
}

export interface ParseResult {
  records: DailyRecord[];
  quality: QualityReport;
}

/** Détecte le séparateur (; , tabulation) et lit un CSV avec guillemets. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", "\t", ","]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Date → « AAAA-MM-JJ ». Accepte Date, AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA. */
export function parseDateCell(cell: Cell): string | null {
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    return validYmd(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }
  if (typeof cell !== "string") return null;
  const s = cell.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s.*)?$/.exec(s);
  if (m) return validYmd(+m[3], +m[2], +m[1]);
  return null;
}

const MISSING_TEXT = new Set(["", "na", "n/a", "nan", "null", "-", "--", "nd", "n.d.", "nodata"]);
const MISSING_CODES = new Set([-99, -999, -9999]);

type ParsedValue = { kind: "value"; value: number } | { kind: "missing" } | { kind: "code" } | { kind: "invalid" };

function parseValueCell(cell: Cell): ParsedValue {
  if (cell === null || cell === undefined) return { kind: "missing" };
  let n: number;
  if (typeof cell === "number") n = cell;
  else if (typeof cell === "string") {
    const s = cell.trim().toLowerCase();
    if (MISSING_TEXT.has(s)) return { kind: "missing" };
    n = Number(s.replace(/\s/g, "").replace(",", "."));
  } else return { kind: "invalid" };
  if (!Number.isFinite(n)) return { kind: "invalid" };
  if (MISSING_CODES.has(n)) return { kind: "code" };
  return { kind: "value", value: n };
}

const norm = (c: Cell) =>
  String(c ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Transforme des lignes brutes (CSV ou Excel) en série journalière + rapport de qualité.
 * Colonnes attendues : Date et Valeur (en-tête reconnu ; à défaut : colonnes 1 et 2).
 */
export function rowsToDaily(rows: Cell[][], options: { suspectThreshold?: number } = {}): ParseResult {
  const suspectThreshold = options.suspectThreshold ?? 300;
  const warnings: string[] = [];
  let dateCol = 0;
  let valueCol = 1;
  let first = 0;

  if (rows.length && parseDateCell(rows[0][0]) === null) {
    const header = rows[0].map(norm);
    const d = header.findIndex((h) => h.includes("date") || h === "jour");
    const v = header.findIndex((h, i) => i !== d && /valeur|value|pluie|rain|precip|debit|flow|rr|mm|hauteur/.test(h));
    if (d >= 0) dateCol = d;
    if (v >= 0) valueCol = v;
    else valueCol = dateCol === 0 ? 1 : 0;
    first = 1;
  }

  const byDate = new Map<string, number | null>();
  const q: QualityReport = {
    rowsRead: 0,
    badDateRows: [],
    validValues: 0,
    missingValues: 0,
    missingCodes: 0,
    negativeValues: 0,
    invalidValues: 0,
    duplicateDates: 0,
    conflictingDuplicates: 0,
    start: null,
    end: null,
    calendarDays: 0,
    absentDays: 0,
    suspectThreshold,
    suspectValues: [],
    maxValue: null,
    warnings,
  };

  for (let i = first; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    q.rowsRead++;
    const date = parseDateCell(row[dateCol]);
    if (!date) {
      q.badDateRows.push(i + 1);
      continue;
    }
    const parsed = parseValueCell(row[valueCol]);
    let value: number | null = null;
    if (parsed.kind === "value") {
      if (parsed.value < 0) q.negativeValues++;
      else value = parsed.value;
    } else if (parsed.kind === "code") q.missingCodes++;
    else if (parsed.kind === "invalid") q.invalidValues++;

    if (byDate.has(date)) {
      q.duplicateDates++;
      const kept = byDate.get(date);
      if (kept !== value && kept !== null && value !== null) q.conflictingDuplicates++;
      if (kept === null && value !== null) byDate.set(date, value); // une valeur remplace une lacune
      continue;
    }
    byDate.set(date, value);
  }

  const dates = [...byDate.keys()].sort();
  const records: DailyRecord[] = dates.map((date) => ({ date, value: byDate.get(date)! }));

  for (const r of records) {
    if (r.value === null) {
      q.missingValues++;
      continue;
    }
    q.validValues++;
    if (!q.maxValue || r.value > q.maxValue.value) q.maxValue = { date: r.date, value: r.value };
    if (r.value > suspectThreshold) q.suspectValues.push({ date: r.date, value: r.value });
  }
  q.suspectValues.sort((a, b) => b.value - a.value);
  q.suspectValues = q.suspectValues.slice(0, 5);

  if (dates.length) {
    q.start = dates[0];
    q.end = dates[dates.length - 1];
    const ms = (s: string) => Date.parse(`${s}T00:00:00Z`);
    q.calendarDays = Math.round((ms(q.end) - ms(q.start)) / 86400000) + 1;
    q.absentDays = q.calendarDays - dates.length;
  }

  if (q.badDateRows.length) warnings.push(`${q.badDateRows.length} ligne(s) ignorée(s) : date illisible (ex. ligne ${q.badDateRows[0]}).`);
  if (q.duplicateDates) warnings.push(`${q.duplicateDates} date(s) en double (première valeur conservée).`);
  if (q.conflictingDuplicates) warnings.push(`${q.conflictingDuplicates} doublon(s) avec des valeurs différentes : à vérifier dans le fichier source.`);
  if (q.negativeValues) warnings.push(`${q.negativeValues} valeur(s) négative(s) traitée(s) comme lacune.`);
  if (q.invalidValues) warnings.push(`${q.invalidValues} valeur(s) non numérique(s) traitée(s) comme lacune.`);
  if (q.missingCodes) warnings.push(`${q.missingCodes} valeur(s) -99/-999/-9999 interprétée(s) comme lacune.`);
  if (q.absentDays > 0) warnings.push(`${q.absentDays} jour(s) absent(s) du fichier entre le début et la fin.`);
  if (q.suspectValues.length) warnings.push(`Valeurs supérieures à ${suspectThreshold} : à vérifier (conservées dans l'analyse).`);

  return { records, quality: q };
}

/** Maxima mensuels (aperçu graphique : évite de tracer plusieurs milliers de barres). */
export function monthlyMaxima(records: DailyRecord[]): { month: string; max: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.value === null) continue;
    const key = r.date.slice(0, 7);
    if (!map.has(key) || r.value > map.get(key)!) map.set(key, r.value);
  }
  return [...map.entries()].sort().map(([month, max]) => ({ month, max }));
}
