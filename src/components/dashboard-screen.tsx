"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, CloudRain, FlaskConical, MapPin, RefreshCw, UploadCloud } from "lucide-react";
import { KpiCard } from "./kpi-card";
import { StationMapCard } from "./station-map-card";
import { dashboardKpis, summarizeDatasets, ALERT_PERIOD } from "@/lib/dashboard";
import { useDatasets } from "@/lib/dataset-store";
import { TEST_DATA_UPDATED_AT, getKpis, stations as demoStations, type Station } from "@/lib/stations";

const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

export function DashboardScreen() {
  const { datasets } = useDatasets();
  const summaries = useMemo(() => summarizeDatasets(datasets), [datasets]);
  const real = summaries.length > 0;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-brand-900">Tableau de bord</h1>
        <p className="mt-1 text-muted">Vue d&apos;ensemble des stations hydrologiques et des extrêmes.</p>
      </div>
    </div>
  );

  if (!real) {
    const { activeCount, lastExtremeMm, critical } = getKpis();
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {header}
        <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 p-4 text-sm">
          <FlaskConical className="size-5 shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1">
            Vous voyez des <strong>stations de démonstration</strong>. Importez vos séries pour afficher vos propres stations, extrêmes et alertes.
          </p>
          <Link href="/donnees" className="flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
            <UploadCloud className="size-4" /> Importer mes données
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard icon={MapPin} value={String(activeCount)} label="Stations actives" detail="En service" detailTone="ok" />
          <KpiCard icon={CloudRain} value={String(lastExtremeMm)} unit="mm" label="Dernière extrême" detail={`Enregistrée le 24/05/2024 (${TEST_DATA_UPDATED_AT})`} />
          <KpiCard
            icon={AlertTriangle}
            value={critical?.name ?? "Aucune"}
            label="Station critique"
            detail={critical ? "Niveau extrême élevé" : "Aucun dépassement de seuil"}
            detailTone={critical ? "danger" : "ok"}
            highlight
          />
        </div>
        <StationMapCard stations={demoStations} />
      </div>
    );
  }

  const k = dashboardKpis(summaries);
  const mapStations: Station[] = summaries
    .filter((s) => s.lat !== undefined && s.lng !== undefined)
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.kind,
      status: s.status,
      lat: s.lat as number,
      lng: s.lng as number,
      lastExtremeMm: s.lastMax,
    }));
  const lastImport = datasets
    .filter((d) => !d.isTest && d.importedAt)
    .map((d) => d.importedAt)
    .sort()
    .at(-1);
  const missing = k.count - k.withPosition;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Tableau de bord</h1>
          <p className="mt-1 text-muted">Vue d&apos;ensemble des stations hydrologiques et des extrêmes.</p>
        </div>
        {lastImport && (
          <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm">
            <RefreshCw className="size-4" />
            Dernier import : {new Date(lastImport).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          icon={MapPin}
          value={String(k.count)}
          label={k.count > 1 ? "Stations importées" : "Station importée"}
          detail={
            missing > 0
              ? `${missing} sans position (voir Données & import)`
              : `${k.rainCount} pluie · ${k.flowCount} débit`
          }
          detailTone={missing > 0 ? "neutral" : "ok"}
        />
        {k.record ? (
          <KpiCard
            icon={CloudRain}
            value={k.record.recordMax.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
            unit="mm"
            label="Plus forte pluie journalière"
            detail={`${k.record.name} · ${k.record.recordDate ? fmtDate(k.record.recordDate) : k.record.recordYear}`}
          />
        ) : (
          <KpiCard icon={CloudRain} value="—" label="Plus forte pluie journalière" detail="Aucune série de pluie importée" />
        )}
        <KpiCard
          icon={AlertTriangle}
          value={k.critical?.name ?? "Aucune"}
          label="Station critique"
          detail={
            k.critical
              ? `Dernier maximum (${k.critical.lastYear}) ≥ valeur T = ${ALERT_PERIOD} ans`
              : `Aucun dépassement de la valeur T = ${ALERT_PERIOD} ans`
          }
          detailTone={k.critical ? "danger" : "ok"}
          highlight
        />
      </div>

      <StationMapCard
        stations={mapStations}
        subtitle="Stations dont la position est renseignée"
        emptyHint="Aucune position renseignée : ajoutez la latitude et la longitude dans « Données & import » (menu ⋯ de la station)."
      />

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-bold text-brand-900">Stations</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Station</th>
                <th className="pr-3">Type</th>
                <th className="pr-3">Années</th>
                <th className="pr-3">Dernier maximum</th>
                <th className="pr-3">Valeur T = {ALERT_PERIOD} ans</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.id} className="border-b border-line/70">
                  <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                  <td className="pr-3">{s.kind}</td>
                  <td className="pr-3 tabular-nums">{s.years}</td>
                  <td className="pr-3 tabular-nums">
                    {s.lastMax.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {s.unit} ({s.lastYear})
                  </td>
                  <td className="pr-3 tabular-nums">
                    {s.threshold ? `${s.threshold.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${s.unit}` : "n/d (série trop courte)"}
                  </td>
                  <td>
                    {s.status === "critical" ? (
                      <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">Critique</span>
                    ) : (
                      <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">Normale</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Une station est « critique » lorsque son dernier maximum annuel atteint la valeur de période de retour {ALERT_PERIOD} ans de la loi la
          mieux ajustée (AICc).
        </p>
      </section>
    </div>
  );
}
