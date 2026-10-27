import { AlertTriangle, CloudRain, Filter, MapPin, RefreshCw } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { StationMapCard } from "@/components/station-map-card";
import { TEST_DATA_UPDATED_AT, getKpis } from "@/lib/stations";

export default function DashboardPage() {
  const { activeCount, lastExtremeMm, critical } = getKpis();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Tableau de bord</h1>
          <p className="mt-1 text-muted">Vue d&apos;ensemble des stations hydrologiques et des extrêmes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm">
            <RefreshCw className="size-4" />
            Données mises à jour : {TEST_DATA_UPDATED_AT}
          </div>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-brand-50"
          >
            <Filter className="size-4" />
            Filtres
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          icon={MapPin}
          value={String(activeCount)}
          label="Stations actives"
          detail="En service"
          detailTone="ok"
        />
        <KpiCard
          icon={CloudRain}
          value={String(lastExtremeMm)}
          unit="mm"
          label="Dernière extrême"
          detail="Enregistrée le 24/05/2024"
        />
        <KpiCard
          icon={AlertTriangle}
          value={critical?.name ?? "Aucune"}
          label="Station critique"
          detail={critical ? "Niveau extrême élevé" : "Aucun dépassement de seuil"}
          detailTone={critical ? "danger" : "ok"}
          highlight
        />
      </div>

      <StationMapCard />
    </div>
  );
}
