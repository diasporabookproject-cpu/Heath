import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import CuisineView from './cuisine/CuisineView';
import SecuriteView from './views/SecuriteView';
import EspaceView from './views/EspaceView';
import AccountSheet from './components/AccountSheet';
import { readEspaceToken } from './lib/espace';
import { supabaseEnabled } from './lib/supabase';
import { useSession } from './lib/useSession';

type Tab = 'cuisine' | 'securite';

const TABS: { id: Tab; label: string; icon: string; title: string }[] = [
  { id: 'cuisine', label: 'Cuisine', icon: '🍽️', title: 'Cuisine' },
  { id: 'securite', label: 'Sécurité', icon: '🛡️', title: 'Sécurité du foyer' },
];

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [tab, setTab] = useState<Tab>('cuisine');
  const [accountOpen, setAccountOpen] = useState(false);
  const { session } = useSession();

  // Espace permanent d'un destinataire (#e=) : lecture seule, sans données locales.
  const espaceToken = readEspaceToken();

  useEffect(() => {
    if (!espaceToken) void init();
  }, [init, espaceToken]);

  if (espaceToken) return <EspaceView token={espaceToken} />;

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      {tab === 'cuisine' ? (
        !ready ? (
          <div className="spinner">Chargement…</div>
        ) : (
          <CuisineView
            showAccount={supabaseEnabled}
            connected={!!session}
            onOpenAccount={() => setAccountOpen(true)}
          />
        )
      ) : (
        <>
          <header className="topbar">
            <span>{current.title}</span>
            {supabaseEnabled && (
              <button
                className="account-btn"
                onClick={() => setAccountOpen(true)}
                aria-label="Compte et synchro"
                title={session ? `Connecté : ${session.user.email}` : 'Se connecter'}
              >
                {session ? '☁︎' : '☁︎ Connexion'}
              </button>
            )}
          </header>
          <main className="app__main">
            {!ready ? <div className="spinner">Chargement…</div> : <SecuriteView />}
          </main>
        </>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tabbar__item' + (t.id === tab ? ' tabbar__item--active' : '')}
            onClick={() => setTab(t.id)}
          >
            <span className="tabbar__icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {accountOpen && <AccountSheet session={session} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
