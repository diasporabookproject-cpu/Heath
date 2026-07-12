import React from 'react';
import ReactDOM from 'react-dom/client';
import Boot from './ftue/Boot';
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
