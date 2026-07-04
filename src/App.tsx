import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import MaisonView from './maison/MaisonView';
import CuisineView from './cuisine/CuisineView';
import NounouView from './nounou/NounouView';
import SecuriteView from './views/SecuriteView';
import EspaceView from './views/EspaceView';
import MzDemo from './ui/MzDemo';
import AccountSheet from './components/AccountSheet';
import { Sheet } from './ui/primitives';
import { readEspaceToken } from './lib/espace';
import { supabaseEnabled } from './lib/supabase';
import { useSession } from './lib/useSession';
import type { Personne } from './maison/personnes';

// Navigation hub (L1-2) : Maison = écran racine ; les pages de rôle s'ouvrent en
// plein écran avec un retour « ‹ Maison ». Plus de bottom-tabs — la personne est
// un contexte, la page un contenu. Les liens `#e=` (espaces reçus) restent
// intouchés (court-circuit avant tout rendu applicatif).
type Screen = 'maison' | 'cuisine' | 'nounou' | 'securite';

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [screen, setScreen] = useState<Screen>('maison');
  const [accountOpen, setAccountOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  // Jeton du destinataire à cibler quand on ouvre une page via « Envoyer »
  // (personne = contexte) : la page ouvre sa feuille d'envoi pré-sélectionnée.
  const [shareFor, setShareFor] = useState<string | null>(null);
  const { session } = useSession();

  // Espace permanent d'un destinataire (#e=) : lecture seule, sans données locales.
  const espaceToken = readEspaceToken();

  // Vitrine dev du design system mz- (Lot 0) : #mz-demo. Hors nav de prod.
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!espaceToken) void init();
  }, [init, espaceToken]);

  if (hash === '#mz-demo') return <MzDemo />;
  if (espaceToken) return <EspaceView token={espaceToken} />;

  // Ouvrir une page depuis Maison. La personne est portée comme contexte (Lot 3
  // câblera l'envoi ciblé) ; pour l'instant elle ouvre la page de son rôle.
  const openPage = (kind: 'cuisine' | 'nounou', person?: Personne, share?: boolean) => {
    setScreen(kind);
    setShareFor(share && person ? person.token : null);
  };
  const back = () => {
    setScreen('maison');
    setShareFor(null);
  };

  return (
    <div className="app">
      {screen === 'maison' ? (
        <MaisonView
          onOpenPage={openPage}
          onOpenSecurite={() => setScreen('securite')}
          onNewPage={() => setNewPageOpen(true)}
          onOpenAccount={() => setAccountOpen(true)}
          showAccount={supabaseEnabled}
        />
      ) : screen === 'cuisine' ? (
        !ready ? (
          <div className="spinner">Chargement…</div>
        ) : (
          <CuisineView
            showAccount={supabaseEnabled}
            connected={!!session}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={back}
            initialShareToken={shareFor ?? undefined}
            onConsumeShare={() => setShareFor(null)}
          />
        )
      ) : screen === 'nounou' ? (
        <NounouView
          showAccount={supabaseEnabled}
          connected={!!session}
          onOpenAccount={() => setAccountOpen(true)}
          onBack={back}
          initialShareToken={shareFor ?? undefined}
          onConsumeShare={() => setShareFor(null)}
        />
      ) : (
        <>
          <header className="topbar">
            <button className="topbar__back" onClick={back} aria-label="Retour à Maison">
              ‹ Maison
            </button>
            <span>Sécurité du foyer</span>
            {supabaseEnabled ? (
              <button
                className="account-btn"
                onClick={() => setAccountOpen(true)}
                aria-label="Compte et synchro"
                title={session ? `Connecté : ${session.user.email}` : 'Se connecter'}
              >
                {session ? '☁︎' : '☁︎ Connexion'}
              </button>
            ) : (
              <span style={{ width: 64 }} />
            )}
          </header>
          <main className="app__main">
            {!ready ? <div className="spinner">Chargement…</div> : <SecuriteView />}
          </main>
        </>
      )}

      {newPageOpen && (
        <Sheet
          title="Une page pour quelqu’un d’autre"
          sub="Les rôles Cuisine et Nounou existent déjà. D’autres arrivent bientôt."
          onClose={() => setNewPageOpen(false)}
        >
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>🧹</span>
            <span>
              <h4>Ménage / Entretien</h4>
              <div className="st">Consignes de nettoyage, produits, zones</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>🚗</span>
            <span>
              <h4>Chauffeur</h4>
              <div className="st">Trajets, horaires, contacts</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>✳️</span>
            <span>
              <h4>Autre rôle</h4>
              <div className="st">Dis-nous ce qu’il te manque</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-sm" style={{ marginTop: 12 }}>
            En attendant, ouvre une page <b>Cuisine</b> ou <b>Nounou</b> depuis Maison.
          </div>
        </Sheet>
      )}
      {accountOpen && <AccountSheet session={session} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
