import { useEffect, useState } from 'react';
import { readEspace, logEspaceOpen, type Espace } from '../lib/espace';
import EspaceCuisine from '../cuisine/EspaceCuisine';
import NounouEspaceView from '../nounou/NounouEspaceView';
import type { NounouEspace } from '../nounou/partage';

// Espace permanent d'un destinataire, ouvert via le lien #e=<token>.
// Lecture publique (sans compte) + cache offline : après une 1re ouverture en
// ligne, l'espace reste consultable hors-ligne. Le payload peut être une page
// Cuisine (menu) ou Nounou (kind:'nounou') — on route selon le contenu.

type Payload = Espace | NounouEspace;
const isNounou = (p: Payload): p is NounouEspace => (p as NounouEspace).kind === 'nounou';

const cacheKey = (token: string) => `espace:${token}`;

export default function EspaceView({ token }: { token: string }) {
  const [espace, setEspace] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'offline'>('loading');

  useEffect(() => {
    let cancelled = false;
    readEspace(token)
      .then((e: Payload | null) => {
        if (cancelled) return;
        if (e) {
          setEspace(e);
          setState('ok');
          void logEspaceOpen(token); // accusé de lecture (best-effort)
          try {
            localStorage.setItem(cacheKey(token), JSON.stringify(e));
          } catch {
            /* quota / mode privé : on ignore */
          }
        } else {
          // pas de contenu en ligne → tenter le cache, sinon espace vide/révoqué
          const cached = readCache(token);
          if (cached) {
            setEspace(cached);
            setState('ok');
          } else {
            setState('empty');
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
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

  if (state === 'empty' || state === 'offline' || !espace) {
    return (
      <div className="app">
        <header className="topbar">Mon espace</header>
        <main className="app__main">
          <p className="empty-note">
            {state === 'offline'
              ? 'Hors-ligne et aucune version enregistrée. Réessaie avec du réseau.'
              : 'Cet espace est vide ou n’est plus disponible.'}
          </p>
        </main>
      </div>
    );
  }

  return isNounou(espace) ? <NounouEspaceView espace={espace} /> : <EspaceCuisine espace={espace} />;
}

function readCache(token: string): Payload | null {
  try {
    const raw = localStorage.getItem(cacheKey(token));
    return raw ? (JSON.parse(raw) as Payload) : null;
  } catch {
    return null;
  }
}
