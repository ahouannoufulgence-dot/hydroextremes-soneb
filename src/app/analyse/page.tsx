import { AnalysisPanel } from "@/components/analysis-panel";
import { analyzeAnnualMaxima, mannKendall, pettitt } from "@/lib/stats";
import { TEST_ANNUAL_MAXIMA, TEST_STATION_LABEL } from "@/lib/test-series";

const values = TEST_ANNUAL_MAXIMA.map((d) => d.max);

// Calcul déterministe (graine fixe) : exécuté une seule fois à la construction du site.
const analysis = analyzeAnnualMaxima(values, { periods: [2, 5, 10, 20, 50, 100, 200] });
const trend = mannKendall(values);
const rupture = pettitt(values);

export default function Page() {
  return (
    <AnalysisPanel
      analysis={analysis}
      series={TEST_ANNUAL_MAXIMA}
      mannKendall={trend}
      pettitt={rupture}
      seriesLabel={TEST_STATION_LABEL}
    />
  );
}
