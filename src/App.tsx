import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import ComposerView from './views/ComposerView';
import CuisinierView from './views/CuisinierView';
import CoursesView from './views/CoursesView';
import BibliothequeView from './views/BibliothequeView';
import SharedMenuView from './views/SharedMenuView';
import { readSharedFromLocation } from './lib/share';

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

  // Lien partagé : si l'URL contient un menu encodé, on affiche la page
  // cuisinière en lecture seule (pas besoin des données locales).
  const shared = readSharedFromLocation();

  useEffect(() => {
    if (!shared) void init();
  }, [init, shared]);

  if (shared) return <SharedMenuView menu={shared} />;

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <header className="topbar">{current.title}</header>
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
    </div>
  );
}
