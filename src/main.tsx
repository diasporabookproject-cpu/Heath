import React from 'react';
import ReactDOM from 'react-dom/client';
import Boot from './ftue/Boot';
import './assets/fonts.css';
// DA v2 (lot UI, T0/T1) — le socle de tokens partagé maquettes ↔ app. Dans le
// bundle CSS il arrive APRÈS mz.css (le graphe de Boot s'exécute avant ces
// imports) ; les 3 noms autrefois partagés (--mz-card/ink/font) ont été purgés
// de mz.css à T1 — tokens.css est leur unique source.
import './tokens.css';
import './styles.css';
import { initSentry } from './lib/sentry';

initSentry();

// F4 (Flow FTUE) : `Boot` = gate pré-boot — décide FTUE vs App AVANT de monter
// App (aucun store ne s'initialise pendant la FTUE). Les vues `#e=`/`#mz-demo`
// court-circuitent vers App, qui les gère comme avant.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>,
);
