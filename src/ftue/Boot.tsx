import { useEffect, useState } from 'react';
import App from '../App';
import Ftue from './Ftue';
import Entrer from './Entrer';
import Foyer from './Foyer';
import { readEspaceToken } from '../lib/espace';
import { hasBootedBefore, loadCompteLie, loadFtueDone, saveFtueDone, saveRolesActifs } from '../lib/db';
import { gateMode } from './gate';

// GATE PRÉ-BOOT (F4, clé de voûte du lot FTUE — cf. READBACK_FLOW_FTUE) : le gate
// s'évalue AU-DESSUS d'App, pas dedans — un early return DANS App laisserait tourner
// ses hooks (useSession/useSync/useStore). Tant que le gate retient, App n'est PAS
// monté : rien ne s'initialise, rien ne se persiste, rien ne peut être poussé.
//
// Ordre (lot Identité & accès T1 — le compte est REQUIS) :
//   ① `#e=` : un DESTINATAIRE qui ouvre un lien ne voit JAMAIS le gate (invariant du
//      produit : le personnel n'a pas de compte). `#mz-demo` court-circuite aussi.
//   ② PAS DE COMPTE LIÉ → ÉCRAN 1 « Entrer ». Aucune échappatoire.
//   ③ `ftueDone` présent → App ;
//   ④ appareil déjà booté (méta `seedVersion`/`seeded`, lues AVANT que le boot courant
//      ne les tamponne) → MIGRATION ONE-SHOT (ftueDone + rôles rétroactifs) → App ;
//   ⑤ sinon → ÉCRAN 2 « le foyer » : fonder (→ FTUE) ou rejoindre (→ app, la FTUE
//      est SAUTÉE : le foyer existe, la jouer écraserait le travail du fondateur).
//
// 🔴 ② teste le DRAPEAU LOCAL `compteLie`, jamais la session vivante : hors-ligne,
// `getSession()` rend `null` dès que le jeton d'accès a expiré, et se reconnecter
// exige le réseau — gater sur la session mettrait l'utilisateur DEHORS dans le métro,
// avec ses données sur son téléphone. Le drapeau ouvre l'app ; la session ne
// conditionne que les opérations réseau, déjà toutes best-effort. (Preuve : test
// `boot-gate.test.ts` + smoke Cuisine, rechargement hors-ligne.)

type Mode = 'checking' | 'entrer' | 'foyer' | 'ftue' | 'app';

export default function Boot() {
  const [mode, setMode] = useState<Mode>(() =>
    readEspaceToken() || window.location.hash === '#mz-demo' ? 'app' : 'checking',
  );

  useEffect(() => {
    if (mode !== 'checking') return;
    void (async () => {
      // L'ordre vit dans `gate.ts` (pur, testé) ; ici, seules les lectures.
      const decision = gateMode({
        espaceToken: !!readEspaceToken(),
        demo: window.location.hash === '#mz-demo',
        compteLie: !!(await loadCompteLie()),
        ftueDone: await loadFtueDone(),
        bootedBefore: await hasBootedBefore(),
      });
      if (decision === 'migrer') {
        // Appareil existant mis à jour : JAMAIS la FTUE — on pose le marqueur et
        // on active les deux rôles rétroactivement (comportement d'avant conservé).
        await saveFtueDone();
        await saveRolesActifs(['cuisine', 'nounou']);
        return setMode('app');
      }
      setMode(decision);
    })();
  }, [mode]);

  if (mode === 'checking') return null; // lecture méta ~ms : pas de flash
  // Compte lié → on re-évalue la suite du gate (FTUE ou App) sans recharger la page.
  if (mode === 'entrer') return <Entrer onDone={() => setMode('checking')} />;
  if (mode === 'foyer') return <Foyer onFonder={() => setMode('ftue')} onRejoint={() => setMode('app')} />;
  if (mode === 'ftue') return <Ftue onDone={() => setMode('app')} />;
  return <App />;
}
