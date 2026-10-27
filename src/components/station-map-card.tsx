"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { stations } from "@/lib/stations";

// Leaflet a besoin du navigateur : pas de rendu côté serveur.
const StationMap = dynamic(() => import("./station-map"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse bg-brand-50" />,
});

function LegendPin({ color }: { color: string }) {
  return (
    <svg width="14" height="18" viewBox="0 0 24 32" aria-hidden>
      <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20 12 32 12 32s12-12 12-20.3C24 5.2 18.6 0 12 0Z" fill={color} />
    </svg>
  );
}

export function StationMapCard() {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? stations.filter((s) => s.name.toLowerCase().includes(q)) : stations;
  }, [query]);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex items-center gap-3">
          <MapPin className="size-6 text-brand-600" fill="currentColor" strokeWidth={1.5} />
          <div>
            <h2 className="font-bold text-brand-900">Porto-Novo, Bénin</h2>
            <p className="text-sm text-muted">Carte des stations de suivi hydrologique</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-10 w-64 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm focus-within:border-brand-500">
            <Search className="size-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une station…"
              aria-label="Rechercher une station"
              className="w-full bg-transparent outline-none placeholder:text-muted"
            />
          </label>
          <button
            type="button"
            aria-label="Filtres de la carte"
            className="grid size-10 place-items-center rounded-xl border border-line hover:bg-brand-50"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <StationMap stations={visible} />
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl border border-line bg-surface/95 p-3 text-sm shadow-[var(--shadow-card)]">
          <div className="mb-2 font-semibold">Légende</div>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2"><LegendPin color="#0b63ce" /> Station active</li>
            <li className="flex items-center gap-2"><LegendPin color="#e5484d" /> Station critique</li>
            <li className="flex items-center gap-2"><LegendPin color="#8a97ab" /> Station inactive</li>
          </ul>
        </div>
        {visible.length === 0 && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-surface/70 text-muted">
            Aucune station ne correspond à « {query} ».
          </div>
        )}
      </div>
    </section>
  );
}
