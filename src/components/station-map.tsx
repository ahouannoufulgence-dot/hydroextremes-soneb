"use client";

import { useMemo } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { Station } from "@/lib/stations";

const COLORS = {
  active: "#0b63ce",
  critical: "#e5484d",
  inactive: "#8a97ab",
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function stationIcon(station: Station) {
  const color = COLORS[station.status];
  const label = station.status === "critical" ? `${station.name} (Critique)` : station.name;
  const inner =
    station.status === "critical"
      ? `<path d="M12 7.2 16.2 14.6H7.8Z" fill="#fff"/><rect x="11.4" y="9.6" width="1.2" height="2.6" fill="${color}"/><rect x="11.4" y="13" width="1.2" height="1.2" fill="${color}"/>`
      : `<path d="M12 6.5c2 2.6 3.4 4.2 3.4 6a3.4 3.4 0 0 1-6.8 0c0-1.8 1.4-3.4 3.4-6Z" fill="#fff"/>`;

  const html = `
    <div style="display:flex;align-items:center;gap:6px;transform:translate(-14px,-38px);white-space:nowrap">
      <svg width="28" height="38" viewBox="0 0 24 32" style="filter:drop-shadow(0 2px 3px rgba(15,31,61,.3));flex:none">
        <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20 12 32 12 32s12-12 12-20.3C24 5.2 18.6 0 12 0Z" fill="${color}"/>
        <g transform="translate(0 0)">${inner}</g>
      </svg>
      <span style="background:#fff;border-radius:8px;padding:3px 9px;font:600 12.5px/1.3 'Inter Variable',system-ui,sans-serif;color:#0f1f3d;box-shadow:0 1px 4px rgba(15,31,61,.18)">${escapeHtml(label)}</span>
    </div>`;

  return L.divIcon({ html, className: "station-marker", iconSize: [0, 0] });
}

export default function StationMap({ stations }: { stations: Station[] }) {
  const icons = useMemo(() => new Map(stations.map((s) => [s.id, stationIcon(s)])), [stations]);

  return (
    <MapContainer
      center={[6.497, 2.628]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-[420px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={icons.get(s.id)!} title={s.name} />
      ))}
    </MapContainer>
  );
}
