export interface DecisionReport {
  rows: { period: number; baseMm: number; adjustedMm: number }[];
  scenarioLabel: string;
  alertPeriod: number;
  alertThresholdMm: number;
  criticalPeriod: number;
  criticalMm: number;
  isTestData: boolean;
}

/** Génère et télécharge le rapport PDF (chargé à la demande pour alléger l'application). */
export async function exportDecisionPdf(report: DecisionReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 20;
  let y = 24;

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(11, 42, 111);
  doc.text("HydroExtrêmes SONEB", left, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(15, 31, 61);
  doc.text("Aide à la décision - Pluies de projet", left, y);
  y += 6;
  doc.setFontSize(9).setTextColor(91, 107, 130);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")} - Scénario : ${report.scenarioLabel}`, left, y);

  if (report.isTestData) {
    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(138, 75, 0);
    doc.text("DONNÉES FICTIVES - ne pas utiliser pour les résultats du mémoire.", left, y);
  }

  y += 12;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(15, 31, 61);
  doc.text("Période de retour", left, y);
  doc.text("Valeur actuelle (mm)", left + 55, y);
  doc.text("Valeur de calcul (mm)", left + 115, y);
  doc.setDrawColor(226, 233, 243).line(left, y + 2, 190, y + 2);
  doc.setFont("helvetica", "normal");
  for (const row of report.rows) {
    y += 8;
    doc.text(`T = ${row.period} ans`, left, y);
    doc.text(String(Math.round(row.baseMm)), left + 55, y);
    doc.text(String(Math.round(row.adjustedMm)), left + 115, y);
  }

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Recommandations", left, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  y += 7;
  doc.text(
    `Seuil d'alerte : >= ${Math.round(report.alertThresholdMm)} mm (T = ${report.alertPeriod} ans).`,
    left,
    y,
  );
  y += 6;
  const crit = doc.splitTextToSize(
    `Ouvrages critiques : valeur de T = ${report.criticalPeriod} ans avec le scénario ${report.scenarioLabel}, soit ${Math.round(report.criticalMm)} mm. À ajuster selon le niveau de risque et la criticité de l'infrastructure.`,
    170,
  );
  doc.text(crit, left, y);

  doc.setFontSize(8).setTextColor(91, 107, 130);
  doc.text(
    "Méthode : analyse fréquentielle des maxima annuels. Les lois et paramètres retenus sont à documenter dans le mémoire.",
    left,
    280,
  );

  doc.save("hydroextremes-aide-decision.pdf");
}
