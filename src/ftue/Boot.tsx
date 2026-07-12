import { useEffect, useState } from 'react';
import App from '../App';
import Ftue from './Ftue';
import { readEspaceToken } from '../lib/espace';
import { hasBootedBefore, loadFtueDone, saveFtueDone, saveRolesActifs } from '../lib/db';

// GATE PRÉ-BOOT (F4, clé de voûte du lot — cf. READBACK_FLOW_FTUE) : la FTUE
// s'évalue AU-DESSUS d'App, pas dedans — un early return DANS App laisserait
// tourner ses hooks (useSession/useSync/useStore). Tant que la FTUE est active,
// App n'est PAS monté : rien ne s'initialise, rien ne se persiste, rien ne peut
// être poussé vers le cloud (F5a-① par construction).
// Ordre : ① `#e=` (un DESTINATAIRE qui ouvre un lien ne voit JAMAIS la FTUE)
// et `#mz-demo` court-circuitent vers App (qui gère ces vues lui-même) ;
// ② `ftueDone` présent → App ; ③ appareil déjà booté (méta `seedVersion`/`seeded`,
// lues AVANT que le boot courant ne les tamponne) → MIGRATION ONE-SHOT (ftueDone
// + rôles activés rétroactifs) → App ; ④ sinon → FTUE.

type Mode = 'checking' | 'ftue' | 'app';

export default function Boot() {
  const [mode, setMode] = useState<Mode>(() =>
    readEspaceToken() || window.location.hash === '#mz-demo' ? 'app' : 'checking',
  );

  useEffect(() => {
    if (mode !== 'checking') return;
    void (async () => {
      if (await loadFtueDone()) return setMode('app');
      if (await hasBootedBefore()) {
        // Appareil existant mis à jour : JAMAIS la FTUE — on pose le marqueur et
        // on active les deux rôles rétroactivement (comportement d'avant conservé).
        await saveFtueDone();
        await saveRolesActifs(['cuisine', 'nounou']);
        return setMode('app');
      }
      setMode('ftue');
    })();
  }, [mode]);

  if (mode === 'checking') return null; // lecture méta ~ms : pas de flash
  if (mode === 'ftue') return <Ftue onDone={() => setMode('app')} />;
  return <App />;
}
