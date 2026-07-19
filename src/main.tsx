import React from 'react';
import ReactDOM from 'react-dom/client';
import Boot from './ftue/Boot';
import './assets/fonts.css';
// DA v2 (lot UI, T0) — le socle de tokens partagé maquettes ↔ app. Importé AVANT
// styles.css/mz.css : 3 noms `--mz-*` collident avec mz.css (card/ink/font, valeurs
// quasi identiques) — mz.css, plus tard dans le graphe, garde la main jusqu'à sa
// purge (tranche B1).
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
