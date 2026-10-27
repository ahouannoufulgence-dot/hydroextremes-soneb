"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Info,
  MapPin,
  MoreHorizontal,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { datasetSeries, type StoredDataset, type VariableKind } from "@/lib/dataset";
import { useDatasets } from "@/lib/dataset-store";
import { monthlyMaxima, parseCsv, rowsToDaily, type Cell, type ParseResult } from "@/lib/import-parse";
import { extractAnnualMaxima } from "@/lib/stats";

const card = "rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]";
const MAX_BYTES = 50 * 1024 * 1024;

const fmtDate = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtInt = (n: number) => n.toLocaleString("fr-FR");

/** Lit une coordonnée en degrés décimaux ; « » = non renseignée, null = invalide. */
function parseCoord(text: string, limit: number): number | undefined | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

async function readRows(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Cell[][];
  }
  return parseCsv(await file.text());
}

export function ImportPanel() {
  const { datasets, active, setActive, add, remove, update } = useDatasets();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VariableKind>("Pluie");
  const [minCompleteness, setMinCompleteness] = useState(0.8);
  const [startMonth, setStartMonth] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [editPos, setEditPos] = useState<string | null>(null);
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  const unit = kind === "Pluie" ? "mm" : "m³/s";

  const annual = useMemo(
    () => (parsed ? extractAnnualMaxima(parsed.records, { minCompleteness, startMonth }) : []),
    [parsed, minCompleteness, startMonth],
  );
  const monthly = useMemo(() => (parsed ? monthlyMaxima(parsed.records) : []), [parsed]);
  const kept = annual.filter((a) => a.included).length;

  const lat = parseCoord(latText, 90);
  const lng = parseCoord(lngText, 180);
  const coordsInvalid = lat === null || lng === null || (lat === undefined) !== (lng === undefined);

  const visible = datasets.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));

  function reset() {
    setFile(null);
    setParsed(null);
    setError(null);
    setLatText("");
    setLngText("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(f: File | undefined) {
    if (!f) return;
    setDone(null);
    setError(null);
    setParsed(null);
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".xls")) {
      setFile(f);
      setError("Le format .xls (ancien Excel) n'est pas pris en charge. Ouvrez le fichier dans Excel et enregistrez-le en .xlsx ou .csv.");
      return;
    }
    if (!/\.(xlsx|csv|txt)$/.test(lower)) {
      setFile(f);
      setError("Format non reconnu. Formats acceptés : .xlsx, .csv (max. 50 Mo).");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(f);
      setError("Fichier trop volumineux (maximum 50 Mo).");
      return;
    }
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim());
    setParsing(true);
    try {
      const rows = await readRows(f);
      const result = rowsToDaily(rows, { suspectThreshold: kind === "Pluie" ? 300 : 5000 });
      if (!result.records.length) {
        setError("Aucune ligne exploitable. Le fichier doit contenir les colonnes Date et Valeur.");
      } else {
        setParsed(result);
      }
    } catch {
      setError("Lecture impossible : le fichier est peut-être corrompu ou protégé.");
    } finally {
      setParsing(false);
    }
  }

  function handleImport() {
    if (!parsed || !parsed.quality.start || !parsed.quality.end || !name.trim() || coordsInvalid) return;
    const ds: StoredDataset = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      kind,
      unit,
      fileName: file?.name ?? "",
      importedAt: new Date().toISOString(),
      start: parsed.quality.start,
      end: parsed.quality.end,
      validDays: parsed.quality.validValues,
      minCompleteness,
      annual: annual.map((a) => ({ year: a.year, max: a.max, dateOfMax: a.dateOfMax, completeness: a.completeness, included: a.included })),
      warnings: parsed.quality.warnings,
      ...(lat !== undefined && lat !== null && lng !== undefined && lng !== null ? { lat, lng } : {}),
    };
    add(ds);
    setDone(`« ${ds.name} » importée : ${datasetSeries(ds).length} maxima annuels retenus. Elle est maintenant la série active pour l'analyse.`);
    reset();
  }

  const q = parsed?.quality;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-brand-600">
          <Database className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Données & import</h1>
          <p className="mt-1 text-muted">Importez des séries journalières, contrôlez leur qualité et extrayez les maxima annuels.</p>
        </div>
      </div>

      {done && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-ok/30 bg-ok-soft p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
          {done}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Liste des séries */}
        <section className={`${card} p-5`}>
          <h2 className="text-lg font-bold text-brand-900">Séries disponibles</h2>
          <p className="text-sm text-muted">Sélectionnez la série utilisée par les écrans d&apos;analyse.</p>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm focus-within:border-brand-500">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une station…"
              aria-label="Rechercher une série"
              className="w-full bg-transparent outline-none placeholder:text-muted"
            />
          </label>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Station</th>
                  <th className="pr-3">Type</th>
                  <th className="pr-3">Période</th>
                  <th className="pr-3">Statut</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const isActive = d.id === active.id;
                  const years = datasetSeries(d).length;
                  return (
                    <Fragment key={d.id}>
                    <tr
                      onClick={() => setActive(d.id)}
                      className={`cursor-pointer border-b border-line/70 ${isActive ? "bg-brand-50 outline outline-1 -outline-offset-1 outline-brand-500/40" : "hover:bg-brand-50/60"}`}
                    >
                      <td className="py-3 pr-3 font-medium">
                        {d.name}
                        {d.isTest && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-[#8a4b00]">fictive</span>}
                        {!d.isTest && (
                          <div className="text-xs font-normal text-muted">
                            {d.lat !== undefined && d.lng !== undefined
                              ? `${d.lat.toFixed(4).replace(".", ",")}° ; ${d.lng.toFixed(4).replace(".", ",")}°`
                              : "Position non renseignée"}
                          </div>
                        )}
                      </td>
                      <td className="pr-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${d.kind === "Pluie" ? "bg-brand-100 text-brand-700" : "bg-ok-soft text-ok"}`}>
                          {d.kind}
                        </span>
                      </td>
                      <td className="pr-3 text-muted">
                        {fmtDate(d.start)} – {fmtDate(d.end)}
                        <div className="text-xs">{years} maxima annuels retenus</div>
                      </td>
                      <td className="pr-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">
                            <span className="size-1.5 rounded-full bg-ok" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-muted">Disponible</span>
                        )}
                      </td>
                      <td className="relative text-right">
                        {!d.isTest && (
                          <>
                            <button
                              type="button"
                              aria-label={`Actions pour ${d.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor(menuFor === d.id ? null : d.id);
                              }}
                              className="grid size-8 place-items-center rounded-lg hover:bg-brand-100"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                            {menuFor === d.id && (
                              <div className="absolute right-0 top-9 z-10 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuFor(null);
                                    setEditPos(d.id);
                                    setEditLat(d.lat !== undefined ? String(d.lat).replace(".", ",") : "");
                                    setEditLng(d.lng !== undefined ? String(d.lng).replace(".", ",") : "");
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-50"
                                >
                                  <MapPin className="size-4" /> Position
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuFor(null);
                                    remove(d.id);
                                  }}
                                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
                                >
                                  <Trash2 className="size-4" /> Supprimer
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                    {editPos === d.id && (
                      <tr className="border-b border-line/70 bg-canvas">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="flex flex-wrap items-end gap-3 text-sm">
                            <label className="space-y-1">
                              <span className="font-medium">Latitude (°)</span>
                              <input value={editLat} onChange={(e) => setEditLat(e.target.value)} className="h-9 w-32 rounded-lg border border-line px-2" />
                            </label>
                            <label className="space-y-1">
                              <span className="font-medium">Longitude (°)</span>
                              <input value={editLng} onChange={(e) => setEditLng(e.target.value)} className="h-9 w-32 rounded-lg border border-line px-2" />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const a = parseCoord(editLat, 90);
                                const o = parseCoord(editLng, 180);
                                if (a === null || o === null || (a === undefined) !== (o === undefined)) return;
                                update(d.id, { lat: a, lng: o });
                                setEditPos(null);
                              }}
                              className="h-9 rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700"
                            >
                              Enregistrer
                            </button>
                            <button type="button" onClick={() => setEditPos(null)} className="h-9 rounded-lg border border-line px-4 hover:bg-brand-50">
                              Annuler
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted">
                      Aucune série ne correspond.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Les séries importées restent dans ce navigateur (aucun envoi sur un serveur). Seuls les maxima annuels et le bilan qualité sont
            conservés.
          </p>
        </section>

        {/* Import */}
        <section className={`${card} p-5`}>
          <h2 className="text-lg font-bold text-brand-900">Importer des données</h2>
          <p className="text-sm text-muted">Ajoutez une série journalière via un fichier Excel (.xlsx) ou CSV.</p>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={`mt-4 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-brand-500 bg-brand-100" : "border-brand-500/50 bg-brand-50/50 hover:bg-brand-50"
            }`}
          >
            <UploadCloud className="size-9 text-brand-600" />
            <div className="font-semibold">Glissez-déposez votre fichier ici</div>
            <div className="text-sm text-muted">ou cliquez pour sélectionner</div>
            <div className="mt-1 text-xs text-muted">Formats acceptés : .xlsx, .csv (max. 50 Mo)</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,.txt"
              className="sr-only"
              aria-label="Choisir un fichier de données"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" />
            Le fichier doit contenir les colonnes Date et Valeur (dates AAAA-MM-JJ ou JJ/MM/AAAA, virgule ou point décimal).
          </p>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
              <FileSpreadsheet className="size-6 shrink-0 text-ok" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2).replace(".", ",")} Mo</div>
              </div>
              <button type="button" aria-label="Retirer le fichier" onClick={reset} className="grid size-8 place-items-center rounded-lg hover:bg-brand-50">
                <X className="size-4" />
              </button>
            </div>
          )}

          {parsing && <p className="mt-3 text-sm text-muted">Lecture du fichier…</p>}
          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </div>
          )}

          {parsed && q && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="col-span-2 space-y-1">
                  <span className="font-medium">Nom de la station</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Latitude (°) - facultatif</span>
                  <input
                    value={latText}
                    onChange={(e) => setLatText(e.target.value)}
                    inputMode="decimal"
                    placeholder="ex. 6,4969"
                    className="h-10 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Longitude (°) - facultatif</span>
                  <input
                    value={lngText}
                    onChange={(e) => setLngText(e.target.value)}
                    inputMode="decimal"
                    placeholder="ex. 2,6289"
                    className="h-10 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-500"
                  />
                </label>
                {coordsInvalid && (
                  <p className="col-span-2 text-sm text-danger">
                    Renseignez les deux coordonnées en degrés décimaux (latitude entre -90 et 90, longitude entre -180 et 180), ou aucune.
                  </p>
                )}
                <label className="space-y-1">
                  <span className="font-medium">Variable</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as VariableKind)} className="h-10 w-full rounded-xl border border-line bg-surface px-2">
                    <option value="Pluie">Pluie journalière (mm)</option>
                    <option value="Débit">Débit journalier (m³/s)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-medium">Début de l&apos;année</span>
                  <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="h-10 w-full rounded-xl border border-line bg-surface px-2">
                    <option value={1}>Année civile (janvier)</option>
                    <option value={4}>Année hydrologique (avril)</option>
                    <option value={5}>Année hydrologique (mai)</option>
                    <option value={9}>Année hydrologique (septembre)</option>
                  </select>
                </label>
                <label className="col-span-2 space-y-1">
                  <span className="font-medium">
                    Complétude minimale d&apos;une année : {Math.round(minCompleteness * 100)} %
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(minCompleteness * 100)}
                    onChange={(e) => setMinCompleteness(Number(e.target.value) / 100)}
                    className="w-full accent-[var(--color-brand-600)]"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={!name.trim() || kept === 0 || coordsInvalid}
                className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud className="size-5" /> Importer les données
              </button>
              {kept === 0 && <p className="text-sm text-danger">Aucune année ne satisfait la complétude demandée.</p>}
            </div>
          )}
        </section>
      </div>

      {parsed && q && (
        <>
          <section className={`${card} p-5`}>
            <h2 className="text-lg font-bold text-brand-900">Contrôle qualité</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Période", `${fmtDate(q.start ?? "")} – ${fmtDate(q.end ?? "")}`],
                ["Jours avec valeur", fmtInt(q.validValues)],
                ["Lacunes (valeur vide)", fmtInt(q.missingValues)],
                ["Jours absents du fichier", fmtInt(q.absentDays)],
                ["Lignes lues", fmtInt(q.rowsRead)],
                ["Doublons de date", fmtInt(q.duplicateDates)],
                ["Dates illisibles", fmtInt(q.badDateRows.length)],
                ["Maximum observé", q.maxValue ? `${q.maxValue.value.toLocaleString("fr-FR")} ${unit} (${fmtDate(q.maxValue.date)})` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-canvas px-3 py-2">
                  <div className="text-xs text-muted">{label}</div>
                  <div className="text-sm font-semibold text-brand-900">{value}</div>
                </div>
              ))}
            </div>
            {q.warnings.length > 0 ? (
              <ul className="mt-4 space-y-1.5 rounded-xl bg-warn-soft p-4 text-sm text-[#8a4b00]">
                {q.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm text-ok">
                <CheckCircle2 className="size-4" /> Aucune anomalie détectée.
              </p>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={`${card} p-5`}>
              <h2 className="font-bold text-brand-900">Aperçu de la série</h2>
              <p className="text-sm text-muted">Maximum mensuel ({unit}), {fmtInt(monthly.length)} mois.</p>
              <div className="mt-3 h-60" role="img" aria-label="Maxima mensuels de la série importée">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="#e2e9f3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#5b6b82", fontSize: 11 }} minTickGap={40} tickFormatter={(m: string) => m.slice(0, 4)} />
                    <YAxis tick={{ fill: "#5b6b82", fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v} ${unit}`} labelFormatter={(m) => `Mois ${m}`} />
                    <Bar dataKey="max" name="Maximum mensuel" fill="#1a73e8" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={`${card} p-5`}>
              <h2 className="font-bold text-brand-900">Maxima annuels extraits</h2>
              <p className="text-sm text-muted">
                {kept} année(s) retenue(s) sur {annual.length}. Une année est exclue si sa complétude est inférieure à {Math.round(minCompleteness * 100)} %.
              </p>
              <div className="mt-3 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3">Année</th>
                      <th className="pr-3">Maximum ({unit})</th>
                      <th className="pr-3">Complétude</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annual.map((a) => (
                      <tr key={a.year} className={`border-b border-line/70 ${a.included ? "" : "text-muted"}`}>
                        <td className="py-2 pr-3 font-medium">{a.year}</td>
                        <td className="pr-3 tabular-nums">{a.max === null ? "—" : a.max.toLocaleString("fr-FR")}</td>
                        <td className="pr-3 tabular-nums">{Math.round(a.completeness * 100)} %</td>
                        <td>
                          {a.included ? <span className="text-ok">Retenue</span> : <span className="text-danger">Exclue</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
