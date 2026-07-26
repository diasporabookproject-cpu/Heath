import { useEffect, useState } from 'react';
import { readEspace, decideEspaceState, logEspaceOpen, type Espace } from '../lib/espace';
import PageMorte from './PageMorte';
import EspaceCuisine from '../cuisine/EspaceCuisine';
import NounouEspaceView from '../nounou/NounouEspaceView';
import type { NounouEspace } from '../nounou/partage';

// Espace permanent d'un destinataire, ouvert via le lien #e=<token>.
// Lecture publique (sans compte) + cache offline : après une 1re ouverture en
// ligne, l'espace reste consultable hors-ligne. Le payload peut être une page
// Cuisine (menu) ou Nounou (kind:'nounou') — on route selon le contenu.
// ④ (audit §7.8) : une page RÉVOQUÉE (F1) ne doit plus être servie depuis le
// cache — on distingue le révoqué (couper le futur, purge) de l'offline (cache OK).

type Payload = Espace | NounouEspace;
const isNounou = (p: Payload): p is NounouEspace => (p as NounouEspace).kind === 'nounou';

const cacheKey = (token: string) => `espace:${token}`;

export default function EspaceView({ token }: { token: string }) {
  const [espace, setEspace] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'revoked' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    readEspace(token)
      .then((read) => {
        if (cancelled) return;
        const cached = readCache(token);
        switch (decideEspaceState(read.status, !!cached)) {
          case 'page-live': {
            const payload = (read as { espace: Espace }).espace as Payload;
            setEspace(payload);
            setState('ok');
            void logEspaceOpen(token); // accusé de lecture (best-effort)
            try {
              localStorage.setItem(cacheKey(token), JSON.stringify(payload));
            } catch {
              /* quota / mode privé : on ignore */
            }
            break;
          }
          case 'page-cache':
            setEspace(cached);
            setState('ok');
            break;
          case 'revoked':
            // le lien a été coupé → on efface la copie locale (couper le futur).
            try {
              localStorage.removeItem(cacheKey(token));
            } catch {
              /* ignore */
            }
            setEspace(null);
            setState('revoked');
            break;
          default:
            setState('offline');
        }
      })
      .catch(() => {
        if (cancelled) return;
        // readEspace ne lève pas, mais par prudence : erreur inattendue = offline.
        const cached = readCache(token);
        if (cached) {
          setEspace(cached);
          setState('ok');
        } else {
          setState('offline');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="app">
        <header className="topbar">Mon espace</header>
        <main className="app__main">
          <div className="spinner">Chargement…</div>
        </main>
      </div>
    );
  }

  // T5 : la page morte a son propre écran (option A) — et « hors-ligne » y reste
  // DISTINCT du « mort » : dans un cas il n'y a plus rien à attendre, dans l'autre
  // le lien est vivant et revenir avec du réseau suffit.
  if (state === 'revoked' || state === 'offline' || !espace) {
    return <PageMorte cause={state === 'offline' ? 'horsligne' : 'morte'} />;
  }

  return isNounou(espace) ? <NounouEspaceView espace={espace} /> : <EspaceCuisine espace={espace} token={token} />;
}

function readCache(token: string): Payload | null {
  try {
    const raw = localStorage.getItem(cacheKey(token));
    return raw ? (JSON.parse(raw) as Payload) : null;
  } catch {
    return null;
  }
}
