/**
 * DONNÉES FICTIVES — pour tester l'interface uniquement.
 * Les noms de stations viennent des maquettes ; les coordonnées sont
 * approximatives et les valeurs sont inventées. À remplacer par les
 * vraies données de la SONEB avant toute exploitation dans le mémoire.
 */

export type StationStatus = "active" | "critical" | "inactive";
export type StationType = "Pluie" | "Débit";

export interface Station {
  id: string;
  name: string;
  type: StationType;
  status: StationStatus;
  lat: number;
  lng: number;
  lastExtremeMm: number;
}

export const IS_TEST_DATA = true;
export const TEST_DATA_UPDATED_AT = "24/05/2024 08:30";

export const stations: Station[] = [
  { id: "pn-centre", name: "Porto-Novo Centre", type: "Pluie", status: "active", lat: 6.4969, lng: 2.6289, lastExtremeMm: 61 },
  { id: "pn-ouando", name: "Ouando", type: "Pluie", status: "critical", lat: 6.5232, lng: 2.6125, lastExtremeMm: 87 },
  { id: "pn-djassin", name: "Djassin", type: "Débit", status: "active", lat: 6.4801, lng: 2.6012, lastExtremeMm: 44 },
  { id: "pn-aeroport", name: "Aéroport", type: "Pluie", status: "active", lat: 6.5105, lng: 2.6561, lastExtremeMm: 52 },
  { id: "pn-zogba", name: "Zogba", type: "Débit", status: "inactive", lat: 6.4672, lng: 2.6405, lastExtremeMm: 0 },
  { id: "pn-akpakpa", name: "Akpakpa", type: "Pluie", status: "active", lat: 6.4895, lng: 2.6548, lastExtremeMm: 58 },
];

export function getKpis(list: Station[] = stations) {
  const operational = list.filter((s) => s.status !== "inactive");
  const critical = list.find((s) => s.status === "critical") ?? null;
  const lastExtremeMm = Math.max(...list.map((s) => s.lastExtremeMm));
  return {
    activeCount: operational.length,
    totalCount: list.length,
    lastExtremeMm,
    critical,
  };
}
