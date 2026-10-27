import { DecisionPanel } from "@/components/decision-panel";
import { analyzeAnnualMaxima } from "@/lib/stats";
import { TEST_ANNUAL_MAXIMA, TEST_STATION_LABEL } from "@/lib/test-series";

// Calcul déterministe (graine fixe) : exécuté une seule fois à la construction du site.
const analysis = analyzeAnnualMaxima(TEST_ANNUAL_MAXIMA.map((d) => d.max));

export default function Page() {
  return <DecisionPanel analysis={analysis} seriesLabel={TEST_STATION_LABEL} />;
}
