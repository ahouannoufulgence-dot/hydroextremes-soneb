# HydroExtrêmes SONEB

Outil numérique d'aide à la décision pour l'analyse fréquentielle des extrêmes pluviométriques et hydrologiques (stations SONEB, Porto-Novo).

## Stack
Next.js · TypeScript · Tailwind CSS · Leaflet / OpenStreetMap · Recharts · Lucide

## Démarrer
```bash
npm install
npm run dev
```

## État
- Tableau de bord (indicateurs + carte des stations)
- Aide à la décision : quantiles calculés par le moteur statistique, scénarios +10 % / +20 %, export PDF
- Moteur d'analyse fréquentielle (`src/lib/stats`) : Gumbel, GEV, Log-normale, Log-Pearson III ; tests KS, AIC/AICc/BIC ; intervalles de confiance par bootstrap paramétrique ; Mann-Kendall, Pettitt ; maxima annuels
- Analyse & fréquences : papier de probabilité, comparaison des lois, quantiles, tendance et rupture
- Données & import : lecture CSV / Excel (.xlsx), contrôle qualité (lacunes, doublons, dates, valeurs suspectes), extraction des maxima annuels avec complétude ; les séries importées restent dans le navigateur (localStorage) et alimentent l'analyse et l'aide à la décision
- Les écrans Stations et Rapports sont des pages provisoires ; le Tableau de bord utilise encore des stations fictives.

## Validation du moteur
Les calculs sont comparés à SciPy (valeurs de référence dans `tests/reference/`).

```bash
npm test                                              # 35 tests
python3 -I tests/reference/generate_reference.py      # régénère les références (SciPy)
```

> Les données affichées sont **fictives** (voir `src/lib/stations.ts`).
