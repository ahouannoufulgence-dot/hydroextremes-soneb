import type { StoredDataset } from "@/lib/dataset";
import { TICK_PERIODS, buildPlotData, toU } from "@/lib/plot-data";
import type { Analysis, MannKendallResult, PettittResult } from "@/lib/stats";

export interface ReportInput {
  title: string;
  author: string;
  dataset: StoredDataset;
  label: string;
  series: { year: number; max: number }[];
  analysis: Analysis;
  mannKendall: MannKendallResult;
  pettitt: PettittResult;
  selectedLawId: string;
  alertPeriod: number;
  scenarios: { label: string; uplift: number }[];
}

type RGB = [number, number, number];
const INK: RGB = [15, 31, 61];
const MUTED: RGB = [91, 107, 130];
const BRAND: RGB = [11, 42, 111];
const LINE: RGB = [226, 233, 243];
const LAW_RGB: Record<string, RGB> = {
  gumbel: [11, 99, 206],
  gev: [46, 158, 91],
  lognormal: [242, 140, 40],
  lp3: [124, 77, 255],
};

/** Nombre au format français (virgule), sans espace insécable : la police du PDF ne les gère pas. */
const num = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "n/d");
/** Lettres grecques → ASCII (police Helvetica standard). */
const ascii = (s: string) => s.replace(/μ/g, "mu").replace(/σ/g, "sigma").replace(/ξ/g, "xi").replace(/β/g, "beta");
const frDate = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "-");

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Génère et télécharge le rapport complet (PDF A4, graphique vectoriel). */
export async function exportReportPdf(input: ReportInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { dataset, analysis, series, mannKendall, pettitt } = input;
  const unit = dataset.unit;
  const isTest = !!dataset.isTest;
  const selected = analysis.results.find((r) => r.id === input.selectedLawId) ?? analysis.results[0];
  const best = analysis.results.find((r) => r.rank === 1)!;
  const ci = Math.round(analysis.confidenceLevel * 100);
  const variable = dataset.kind === "Pluie" ? "pluie journalière maximale" : "débit journalier maximal";

  const M = 18;
  const W = 174;
  const BOTTOM = 278;
  let y = 0;

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const newPage = () => {
    doc.addPage();
    y = 22;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const h1 = (text: string) => {
    ensure(16);
    doc.setFont("helvetica", "bold").setFontSize(13);
    color(BRAND);
    doc.text(text, M, y);
    y += 2;
    doc.setDrawColor(...LINE).setLineWidth(0.4).line(M, y, M + W, y);
    y += 7;
  };
  const para = (text: string, opts: { size?: number; bold?: boolean; c?: RGB; gap?: number } = {}) => {
    const size = opts.size ?? 9.5;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(size);
    color(opts.c ?? INK);
    const lines = doc.splitTextToSize(text, W) as string[];
    const lh = size * 0.5;
    ensure(lines.length * lh + 2);
    doc.text(lines, M, y);
    y += lines.length * lh + (opts.gap ?? 2);
  };
  const bullets = (items: string[]) => items.forEach((t) => para(`-  ${t}`, { size: 9, gap: 0.8 }));

  type Col = { label: string; w: number; right?: boolean };
  const table = (cols: Col[], rows: string[][], opts: { rowH?: number; size?: number; boldFirst?: boolean } = {}) => {
    const rowH = opts.rowH ?? 6.2;
    const size = opts.size ?? 8.8;
    const header = () => {
      doc.setFont("helvetica", "bold").setFontSize(size - 0.6);
      color(MUTED);
      let x = M;
      for (const c of cols) {
        doc.text(c.label, c.right ? x + c.w - 1 : x + 1, y, { align: c.right ? "right" : "left" });
        x += c.w;
      }
      y += 1.8;
      doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y, M + W, y);
      y += 4.6;
    };
    ensure(rowH * 2 + 6);
    header();
    for (const r of rows) {
      if (y + rowH > BOTTOM) {
        newPage();
        header();
      }
      doc.setFont("helvetica", "normal").setFontSize(size);
      color(INK);
      let x = M;
      r.forEach((cell, i) => {
        if (i === 0 && opts.boldFirst) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        doc.text(cell, cols[i].right ? x + cols[i].w - 1 : x + 1, y, { align: cols[i].right ? "right" : "left" });
        x += cols[i].w;
      });
      y += 1.8;
      doc.setDrawColor(...LINE).setLineWidth(0.15).line(M, y, M + W, y);
      y += rowH - 1.8;
    }
    y += 3;
  };

  // ---------- Page 1 : en-tête ----------
  doc.setFillColor(...BRAND).rect(0, 0, 210, 30, "F");
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(255, 255, 255);
  doc.text("HydroExtrêmes SONEB", M, 15);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Analyse fréquentielle des extrêmes pluviométriques et hydrologiques", M, 22);

  y = 44;
  doc.setFont("helvetica", "bold").setFontSize(17);
  color(INK);
  const titleLines = doc.splitTextToSize(input.title || `Analyse fréquentielle - ${dataset.name}`, W) as string[];
  doc.text(titleLines, M, y);
  y += titleLines.length * 7.5;
  doc.setFont("helvetica", "normal").setFontSize(10);
  color(MUTED);
  doc.text(`${input.author ? `Établi par : ${input.author} - ` : ""}Généré le ${new Date().toLocaleDateString("fr-FR")}`, M, y);
  y += 9;

  if (isTest) {
    doc.setFillColor(255, 243, 229).roundedRect(M, y - 4.5, W, 11, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(138, 75, 0);
    doc.text("DONNÉES FICTIVES - cette série est générée par l'application. Ne pas utiliser ces résultats dans le mémoire.", M + 3, y + 1.8);
    y += 14;
  }

  h1("1. Série étudiée");
  const retained = series.length;
  table(
    [
      { label: "Élément", w: 62 },
      { label: "Valeur", w: 112 },
    ],
    [
      ["Station", dataset.name],
      ["Variable", `${variable} (${unit})`],
      ["Fichier source", dataset.fileName || "-"],
      ["Période des données", `${frDate(dataset.start)} au ${frDate(dataset.end)}`],
      ["Jours avec valeur", String(dataset.validDays)],
      ["Années retenues", `${retained} sur ${dataset.annual.length} (complétude minimale ${Math.round(dataset.minCompleteness * 100)} %)`],
      ["Moyenne des maxima", `${num(analysis.summary.mean)} ${unit}`],
      ["Écart-type", `${num(analysis.summary.std)} ${unit}`],
      ["Coefficient d'asymétrie", num(analysis.summary.skewness, 2)],
      ["Minimum - maximum", `${num(analysis.summary.min)} - ${num(analysis.summary.max)} ${unit}`],
    ],
    { boldFirst: true },
  );

  h1("2. Méthode");
  para(
    "Les maxima annuels sont extraits de la série journalière ; une année n'est retenue que si sa complétude atteint le seuil indiqué ci-dessus. Quatre lois sont ajustées : Gumbel (maximum de vraisemblance), GEV (L-moments), log-normale (maximum de vraisemblance) et log-Pearson III (méthode des moments sur les logarithmes, asymétrie corrigée du biais).",
  );
  para(
    "L'adéquation est évaluée par le test de Kolmogorov-Smirnov et par les critères AIC, AICc et BIC (le rang est établi selon l'AICc). Les quantiles de période de retour T correspondent à la probabilité de non-dépassement 1 - 1/T. Les intervalles de confiance sont obtenus par bootstrap paramétrique (1 000 rééchantillons, graine fixe, donc reproductible). Les points observés sont placés selon la formule de Weibull, i/(n+1).",
  );
  para("Le moteur de calcul a été validé par comparaison avec SciPy (tests automatiques fournis avec le code source).", { c: MUTED, size: 9 });

  // ---------- Graphique ----------
  ensure(125);
  h1("3. Ajustement sur papier de probabilité");
  const plot = buildPlotData(analysis, selected.id);
  const cx = M;
  const cy = y;
  const cw = W;
  const ch = 92;
  const pL = 15;
  const pB = 11;
  const px0 = cx + pL;
  const py0 = cy + 2;
  const pw = cw - pL - 3;
  const ph = ch - pB - 2;
  const uMin = -1.5;
  const uMax = toU(200) + 0.45;

  let yRaw = 0;
  for (const row of plot.rows) {
    if ((row.u as number) > uMax) continue;
    for (const r of analysis.results) {
      const v = row[r.id];
      if (typeof v === "number") yRaw = Math.max(yRaw, v);
    }
    if (Array.isArray(row.band)) yRaw = Math.max(yRaw, row.band[1]);
  }
  for (const p of plot.points) yRaw = Math.max(yRaw, p.value);
  const step = niceStep(yRaw / 5);
  const yMax = Math.ceil(yRaw / step) * step;
  const sx = (u: number) => px0 + ((u - uMin) / (uMax - uMin)) * pw;
  const sy = (v: number) => py0 + ph - (v / yMax) * ph;

  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setLineWidth(0.15).setDrawColor(...LINE);
  for (let v = 0; v <= yMax + 1e-9; v += step) {
    doc.line(px0, sy(v), px0 + pw, sy(v));
    color(MUTED);
    doc.text(String(Math.round(v * 100) / 100).replace(".", ","), px0 - 2, sy(v) + 1, { align: "right" });
  }
  for (const T of TICK_PERIODS) {
    const x = sx(toU(T));
    doc.line(x, py0, x, py0 + ph);
    color(MUTED);
    doc.text(String(T), x, py0 + ph + 4.5, { align: "center" });
  }
  doc.setDrawColor(...MUTED).setLineWidth(0.3).rect(px0, py0, pw, ph);
  color(MUTED);
  doc.text("Période de retour T (ans)", px0 + pw / 2, py0 + ph + 9, { align: "center" });
  doc.text(`${unit}`, cx + 2, py0 + ph / 2, { angle: 90 });

  // bande de confiance (traits pointillés) de la loi sélectionnée
  const sel = LAW_RGB[selected.id];
  doc.setDrawColor(...sel).setLineWidth(0.3).setLineDashPattern([1.2, 1.2], 0);
  for (const key of [0, 1] as const) {
    let prev: [number, number] | null = null;
    for (const row of plot.rows) {
      const band = row.band;
      if (!Array.isArray(band)) {
        prev = null;
        continue;
      }
      const pt: [number, number] = [sx(row.u as number), sy(band[key])];
      if (prev) doc.line(prev[0], prev[1], pt[0], pt[1]);
      prev = pt;
    }
  }
  doc.setLineDashPattern([], 0);

  for (const r of analysis.results) {
    doc.setDrawColor(...LAW_RGB[r.id]).setLineWidth(r.id === selected.id ? 0.9 : 0.45);
    let prev: [number, number] | null = null;
    for (const row of plot.rows) {
      const u = row.u as number;
      const v = row[r.id];
      if (u > uMax || typeof v !== "number") {
        prev = null;
        continue;
      }
      const pt: [number, number] = [sx(u), sy(v)];
      if (prev) doc.line(prev[0], prev[1], pt[0], pt[1]);
      prev = pt;
    }
  }
  doc.setFillColor(...INK);
  for (const p of plot.points) doc.circle(sx(p.u), sy(p.value), 0.8, "F");

  y = cy + ch + 2;
  // légende
  let lx = M;
  doc.setFontSize(8.2);
  for (const r of analysis.results) {
    doc.setDrawColor(...LAW_RGB[r.id]).setLineWidth(0.9).line(lx, y, lx + 6, y);
    color(INK);
    doc.setFont("helvetica", "normal");
    doc.text(r.label, lx + 8, y + 1);
    lx += 10 + doc.getTextWidth(r.label) + 4;
  }
  doc.setFillColor(...INK).circle(lx + 1, y, 0.8, "F");
  doc.text("Observations", lx + 4, y + 1);
  lx += 8 + doc.getTextWidth("Observations") + 4;
  doc.setDrawColor(...sel).setLineWidth(0.3).setLineDashPattern([1.2, 1.2], 0).line(lx, y, lx + 6, y);
  doc.setLineDashPattern([], 0);
  doc.text(`IC ${ci} % (${selected.label})`, lx + 8, y + 1);
  y += 7;
  para(
    `Figure 1 - Maxima annuels observés (${unit}) et lois ajustées sur papier de probabilité de Gumbel. En pointillés : intervalle de confiance à ${ci} % de la loi ${selected.label}, interpolé entre les périodes de retour calculées.`,
    { size: 8.5, c: MUTED },
  );

  // ---------- Lois ----------
  h1("4. Comparaison des lois");
  table(
    [
      { label: "Rang", w: 9 },
      { label: "Loi", w: 22 },
      { label: "Méthode", w: 33 },
      { label: "Paramètres", w: 56 },
      { label: "KS (D / p)", w: 22 },
      { label: "AICc", w: 16, right: true },
      { label: "BIC", w: 16, right: true },
    ],
    [...analysis.results]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => [
        String(r.rank),
        r.label,
        r.method,
        r.paramNames.map((n, i) => `${ascii(n)} = ${num(r.params[i], 3)}`).join(" ; "),
        `${num(r.ks.statistic, 3)} / ${num(r.ks.pValue, 2)}`,
        num(r.criteria.aicc),
        num(r.criteria.bic),
      ]),
    { size: 7.6 },
  );
  para(
    `Loi au meilleur AICc : ${best.label}. Plus l'AICc est faible, meilleur est l'ajustement compte tenu du nombre de paramètres. Les p-values du test KS sont approximatives, les paramètres étant estimés sur la même série ; elles servent à comparer les lois plutôt qu'à prouver l'adéquation.`,
    { size: 8.8, c: MUTED },
  );

  h1(`5. Quantiles (${unit})`);
  const lawCols = analysis.results.map((r) => ({ label: r.label, w: 27, right: true }));
  table(
    [{ label: "T (ans)", w: 17 }, ...lawCols, { label: `IC ${ci} % (${selected.label})`, w: 174 - 17 - 27 * analysis.results.length, right: true }],
    analysis.results[0].quantiles.map((q, i) => [
      String(q.period),
      ...analysis.results.map((r) => num(r.quantiles[i].value)),
      `${num(selected.quantiles[i].lower)} - ${num(selected.quantiles[i].upper)}`,
    ]),
  );

  h1("6. Tendance et stationnarité");
  para(
    `Mann-Kendall : ${mannKendall.trend === "aucune" ? "pas de tendance significative" : `tendance à la ${mannKendall.trend} significative`} (Z = ${num(mannKendall.z, 2)} ; p = ${num(mannKendall.pValue, 3)} ; pente de Sen = ${num(mannKendall.senSlope, 2)} ${unit}/an).`,
  );
  para(
    `Pettitt : ${pettitt.pValue < 0.05 ? `rupture probable après ${series[pettitt.changeIndex]?.year ?? "?"}` : "pas de rupture significative"} (p = ${num(pettitt.pValue, 3)}, approximation).`,
  );
  para("Une tendance ou une rupture remet en cause l'hypothèse de stationnarité sur laquelle repose l'analyse fréquentielle ; elle doit être discutée avant d'utiliser les quantiles.", { size: 8.8, c: MUTED });

  // ---------- Aide à la décision ----------
  h1("7. Aide à la décision");
  const designPeriods = [10, 50, 100, 200];
  const q = (T: number) => selected.quantiles.find((x) => x.period === T)!;
  const scenCols = input.scenarios.map((s) => ({ label: `Scénario ${s.label}`, w: 33, right: true }));
  table(
    [{ label: "T (ans)", w: 17 }, ...scenCols, { label: `IC ${ci} % (actuel)`, w: 174 - 17 - 33 * input.scenarios.length, right: true }],
    designPeriods.map((T) => [
      String(T),
      ...input.scenarios.map((s) => num(q(T).value * (1 + s.uplift))),
      `${num(q(T).lower)} - ${num(q(T).upper)}`,
    ]),
  );
  para(`Valeurs de calcul (${unit}) selon la loi ${selected.label}, majorées forfaitairement pour tenir compte du changement climatique.`, { size: 8.8, c: MUTED });
  const crit = q(100).value * 1.1;
  para(`Seuil d'alerte recommandé : >= ${num(q(input.alertPeriod).value, 0)} ${unit}, soit la valeur de période de retour T = ${input.alertPeriod} ans (scénario actuel).`, { bold: true });
  para(
    `Pour les ouvrages critiques, valeur de T = 100 ans avec le scénario +10 % : ${num(crit, 0)} ${unit}. À ajuster selon le niveau de risque et la criticité de l'infrastructure. Ces recommandations sont des aides à la décision à valider par l'ingénieur responsable.`,
    { size: 9 },
  );

  // ---------- Annexes ----------
  h1("8. Maxima annuels");
  const rows = dataset.annual;
  const groups = 3;
  const perGroup = Math.ceil(rows.length / groups);
  const gw = W / groups;
  const cell = (r: (typeof rows)[number] | undefined) =>
    r ? [String(r.year) + (r.included ? "" : " *"), r.max === null ? "-" : num(r.max), `${Math.round(r.completeness * 100)} %`] : ["", "", ""];
  const body: string[][] = [];
  for (let i = 0; i < perGroup; i++) {
    const row: string[] = [];
    for (let g = 0; g < groups; g++) row.push(...cell(rows[g * perGroup + i]));
    body.push(row);
  }
  const colDefs: Col[] = [];
  for (let g = 0; g < groups; g++) {
    colDefs.push({ label: "Année", w: gw * 0.34 }, { label: `Max (${unit})`, w: gw * 0.36, right: true }, { label: "Compl.", w: gw * 0.3, right: true });
  }
  table(colDefs, body, { size: 8, rowH: 5 });
  para("* année exclue de l'ajustement (complétude insuffisante).", { size: 8.5, c: MUTED });

  h1("9. Qualité des données et limites");
  if (dataset.warnings.length) {
    para("Anomalies relevées à l'import :", { bold: true, size: 9 });
    bullets(dataset.warnings);
  } else {
    para("Aucune anomalie relevée à l'import.", { size: 9 });
  }
  para("Limites à mentionner dans le mémoire :", { bold: true, size: 9 });
  bullets([
    "Les quantiles de période de retour élevée (T > n) sont des extrapolations ; leurs intervalles de confiance sont larges.",
    "Les p-values du test KS sont approximatives (paramètres estimés sur l'échantillon).",
    "Pour la loi log-Pearson III, l'AIC est calculé avec des paramètres estimés par les moments, non par maximum de vraisemblance.",
    "Les scénarios +10 % et +20 % sont des majorations forfaitaires, non issues de projections climatiques.",
  ]);

  // ---------- Pieds de page ----------
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8);
    color(MUTED);
    doc.text(`HydroExtrêmes SONEB - ${input.label}`, M, 289, { maxWidth: W - 20 });
    doc.text(`Page ${i} / ${n}`, M + W, 289, { align: "right" });
    if (isTest) {
      doc.setTextColor(138, 75, 0);
      doc.text("DONNÉES FICTIVES", M + W / 2, 293.5, { align: "center" });
    }
  }

  const safe = dataset.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "serie";
  doc.save(`rapport-hydroextremes-${safe}.pdf`);
}
