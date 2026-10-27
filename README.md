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
- Les autres écrans (Stations, Données & import, Rapports) sont des pages provisoires.

## Validation du moteur
Les calculs sont comparés à SciPy (valeurs de référence dans `tests/reference/`).

```bash
npm test                                              # 29 tests
python3 -I tests/reference/generate_reference.py      # régénère les références (SciPy)
```

> Les données affichées sont **fictives** (voir `src/lib/stations.ts`).
