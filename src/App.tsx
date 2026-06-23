import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import ComposerView from './views/ComposerView';
import CuisinierView from './views/CuisinierView';
import CoursesView from './views/CoursesView';
import BibliothequeView from './views/BibliothequeView';
import SharedMenuView from './views/SharedMenuView';
import EspaceView from './views/EspaceView';
import AccountSheet from './components/AccountSheet';
import { readPublishId, readSharedFromLocation, type SharedMenu } from './lib/share';
import { readEspaceToken } from './lib/espace';
import { fetchPublishedMenu } from './lib/publish';
import { supabaseEnabled } from './lib/supabase';
import { useSession } from './lib/useSession';

type Tab = 'composer' | 'cuisinier' | 'courses' | 'biblio';

const TABS: { id: Tab; label: string; icon: string; title: string }[] = [
  { id: 'composer', label: 'Composer', icon: '🗓️', title: 'Menu de la semaine' },
  { id: 'cuisinier', label: 'Cuisinière', icon: '👩‍🍳', title: 'Vue cuisinière' },
  { id: 'courses', label: 'Courses', icon: '🛒', title: 'Liste de courses' },
  { id: 'biblio', label: 'Recettes', icon: '📖', title: 'Bibliothèque' },
];

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [tab, setTab] = useState<Tab>('composer');
  const [accountOpen, setAccountOpen] = useState(false);
  const { session } = useSession();

  // Liens lecture seule : menu encodé (#m=), menu publié (#p=), ou espace
  // permanent d'un destinataire (#e=). Aucun ne nécessite les données locales.
  const shared = readSharedFromLocation();
  const publishId = readPublishId();
  const espaceToken = readEspaceToken();

  useEffect(() => {
    if (!shared && !publishId && !espaceToken) void init();
  }, [init, shared, publishId, espaceToken]);

  if (shared) return <SharedMenuView menu={shared} />;
  if (publishId) return <PublishedMenu id={publishId} />;
  if (espaceToken) return <EspaceView token={espaceToken} />;

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
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
        {!ready ? (
          <div className="spinner">Chargement…</div>
        ) : tab === 'composer' ? (
          <ComposerView />
        ) : tab === 'cuisinier' ? (
          <CuisinierView />
        ) : tab === 'courses' ? (
          <CoursesView />
        ) : (
          <BibliothequeView />
        )}
      </main>
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

/** Page cuisinière d'un menu publié (lien #p=), chargé depuis Supabase. */
function PublishedMenu({ id }: { id: string }) {
  const [menu, setMenu] = useState<SharedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedMenu(id)
      .then(setMenu)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="app">
        <header className="topbar">Menu de la semaine</header>
        <main className="app__main">
          <p className="empty-note">{error}</p>
        </main>
      </div>
    );
  }
  if (!menu) {
    return (
      <div className="app">
        <header className="topbar">Menu de la semaine</header>
        <main className="app__main">
          <div className="spinner">Chargement…</div>
        </main>
      </div>
    );
  }
  return <SharedMenuView menu={menu} />;
}
