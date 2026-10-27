"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, FileText, FlaskConical } from "lucide-react";
import { Problem } from "./analysis-screen";
import { useActiveAnalysis } from "./active-analysis";
import { SCENARIOS } from "@/lib/design-rainfall";
import { annualMaximaCsv, downloadText, quantilesCsv } from "@/lib/export-csv";
import { exportReportPdf } from "@/lib/report-pdf";

const card = "rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]";

const CONTENTS = [
  "Série étudiée et statistiques descriptives",
  "Méthode (lois, estimation, tests, intervalles de confiance)",
  "Papier de probabilité avec les 4 lois et la bande de confiance",
  "Comparaison des lois (KS, AICc, BIC)",
  "Quantiles de T = 2 à 200 ans avec intervalles de confiance",
  "Tendance (Mann-Kendall) et rupture (Pettitt)",
  "Aide à la décision : valeurs de calcul, scénarios, seuil d'alerte",
  "Maxima annuels, anomalies à l'import et limites de l'étude",
];

export function ReportScreen() {
  const r = useActiveAnalysis([2, 5, 10, 20, 50, 100, 200]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [lawId, setLawId] = useState<string>("");
  const [alertPeriod, setAlertPeriod] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!r.analysis || !r.mannKendall || !r.pettitt) return <Problem message={r.error ?? "Analyse indisponible."} />;

  const { analysis, dataset } = r;
  const best = analysis.results.find((x) => x.rank === 1)!;
  const selectedId = analysis.results.some((x) => x.id === lawId) ? lawId : best.id;
  const selected = analysis.results.find((x) => x.id === selectedId)!;
  const safeName = dataset.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "serie";

  async function makePdf() {
    if (!r.analysis || !r.mannKendall || !r.pettitt) return;
    setBusy(true);
    setMessage(null);
    try {
      await exportReportPdf({
        title,
        author,
        dataset: r.dataset,
        label: r.label,
        series: r.series,
        analysis: r.analysis,
        mannKendall: r.mannKendall,
        pettitt: r.pettitt,
        selectedLawId: selectedId,
        alertPeriod,
        scenarios: SCENARIOS.map((s) => ({ label: s.label, uplift: s.uplift })),
      });
      setMessage("Rapport PDF généré.");
    } catch {
      setMessage("La génération du PDF a échoué. Réessayez ou rechargez la page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-brand-600">
          <FileText className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Rapports & exports</h1>
          <p className="mt-1 text-muted">Rapport PDF complet et exports CSV de la série active.</p>
        </div>
      </div>

      {dataset.isTest && (
        <div role="status" className="flex items-start gap-3 rounded-xl bg-warn-soft p-4 text-sm text-[#8a4b00]">
          <FlaskConical className="mt-0.5 size-5 shrink-0" />
          La série active est fictive : le rapport portera la mention « DONNÉES FICTIVES » sur chaque page. Importez vos données réelles dans
          « Données & import » pour produire les résultats du mémoire.
        </div>
      )}

      <section className={`${card} p-5`}>
        <h2 className="font-bold text-brand-900">Série active</h2>
        <p className="mt-1 text-sm text-muted">{r.label}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["Années retenues", `${r.series.length}`],
            ["Variable", `${dataset.kind} (${dataset.unit})`],
            ["Meilleure loi (AICc)", best.label],
            ["Intervalles", `${Math.round(analysis.confidenceLevel * 100)} %`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas px-3 py-2">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold text-brand-900">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-bold text-brand-900">Rapport PDF</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="font-medium">Titre (facultatif)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Analyse fréquentielle - ${dataset.name}`}
              className="h-10 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-500"
            />
          </label>
          <label className="space-y-1">
            <span className="font-medium">Auteur (facultatif)</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-10 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-500" />
          </label>
          <label className="space-y-1">
            <span className="font-medium">Loi retenue pour les valeurs de calcul</span>
            <select value={selectedId} onChange={(e) => setLawId(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-2">
              {[...analysis.results]
                .sort((a, b) => a.rank - b.rank)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                    {x.rank === 1 ? " (meilleur AICc)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="font-medium">Période de retour du seuil d&apos;alerte</span>
            <select value={alertPeriod} onChange={(e) => setAlertPeriod(Number(e.target.value))} className="h-10 w-full rounded-xl border border-line bg-surface px-2">
              {[10, 50, 100, 200].map((t) => (
                <option key={t} value={t}>
                  T = {t} ans
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-4 grid gap-1.5 text-sm md:grid-cols-2">
          {CONTENTS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> {c}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={makePdf}
            disabled={busy}
            className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Download className="size-5" /> {busy ? "Génération…" : "Exporter le rapport PDF"}
          </button>
          {message && <span role="status" className="text-sm text-muted">{message}</span>}
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-bold text-brand-900">Exports CSV (Excel)</h2>
        <p className="mt-1 text-sm text-muted">Séparateur « ; » et virgule décimale, ouverture directe dans Excel en français.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadText(`quantiles-${safeName}.csv`, quantilesCsv(analysis, dataset.unit))}
            className="flex h-11 items-center gap-2 rounded-xl border border-brand-600 px-5 font-semibold text-brand-700 hover:bg-brand-50"
          >
            <FileSpreadsheet className="size-5" /> Quantiles des 4 lois
          </button>
          <button
            type="button"
            onClick={() => downloadText(`maxima-annuels-${safeName}.csv`, annualMaximaCsv(dataset))}
            className="flex h-11 items-center gap-2 rounded-xl border border-brand-600 px-5 font-semibold text-brand-700 hover:bg-brand-50"
          >
            <FileSpreadsheet className="size-5" /> Maxima annuels
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">Loi sélectionnée pour le rapport : {selected.label}.</p>
      </section>
    </div>
  );
}
