/**
 * VALEURS FICTIVES — reprises des maquettes pour tester l'interface.
 * Elles seront remplacées par les quantiles issus du moteur d'analyse
 * fréquentielle appliqué aux vraies données de la SONEB.
 */

export const RETURN_PERIODS = [10, 50, 100, 200] as const;
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];

export const BASE_QUANTILES_MM: Record<ReturnPeriod, number> = {
  10: 92,
  50: 145,
  100: 175,
  200: 210,
};

export const SCENARIOS = [
  { id: "0", label: "Actuel (0%)", uplift: 0 },
  { id: "10", label: "+10%", uplift: 0.1 },
  { id: "20", label: "+20%", uplift: 0.2 },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]["id"];

/** Majoration forfaitaire (changement climatique) appliquée à une pluie de projet. */
export function applyScenario(valueMm: number, uplift: number) {
  return valueMm * (1 + uplift);
}

export function formatMm(valueMm: number) {
  return Math.round(valueMm).toLocaleString("fr-FR");
}

/** Période de retour retenue pour le seuil d'alerte (paramétrable, défaut : 50 ans). */
export const DEFAULT_ALERT_PERIOD: ReturnPeriod = 50;
/** Période de retour recommandée pour les ouvrages critiques. */
export const CRITICAL_WORKS_PERIOD: ReturnPeriod = 100;
