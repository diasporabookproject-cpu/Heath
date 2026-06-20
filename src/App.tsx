import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import ComposerView from './views/ComposerView';
import CuisinierView from './views/CuisinierView';
import BibliothequeView from './views/BibliothequeView';

type Tab = 'composer' | 'cuisinier' | 'biblio';

const TABS: { id: Tab; label: string; icon: string; title: string }[] = [
  { id: 'composer', label: 'Composer', icon: '🗓️', title: 'Menu de la semaine' },
  { id: 'cuisinier', label: 'Cuisinière', icon: '👩‍🍳', title: 'Vue cuisinière' },
  { id: 'biblio', label: 'Recettes', icon: '📖', title: 'Bibliothèque' },
];

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [tab, setTab] = useState<Tab>('composer');

  useEffect(() => {
    void init();
  }, [init]);

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
