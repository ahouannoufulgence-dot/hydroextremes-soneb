"use client";

import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useDatasets } from "@/lib/dataset-store";

/** Bandeau d'avertissement : visible tant que des données fictives alimentent l'écran affiché. */
export function TestBanner() {
  const pathname = usePathname();
  const { active } = useDatasets();

  // Le tableau de bord et la liste des stations affichent encore des stations fictives.
  const demoScreen = pathname === "/" || pathname.startsWith("/stations");
  const usesTestSeries = active.isTest && (pathname.startsWith("/analyse") || pathname.startsWith("/aide-decision") || pathname.startsWith("/donnees"));
  if (!demoScreen && !usesTestSeries) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-1.5 text-xs font-medium text-[#8a4b00]"
    >
      <FlaskConical className="size-3.5" />
      {demoScreen ? "Stations de démonstration (fictives)" : "Série fictive active"} — ne pas utiliser pour les résultats du mémoire
    </div>
  );
}
