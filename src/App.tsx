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
import { checkOwnerNotice, ackOwnerNotice } from './lib/auth';
import { useSession } from './lib/useSession';
import { useSync, type AdoptRequest } from './lib/sync/useSync';
import { downloadExport } from './lib/exportData';
import { useNounou } from './nounou/useNounou';
import type { Personne } from './maison/personnes';

// Navigation hub (L1-2) : Maison = écran racine ; les pages de rôle s'ouvrent en
// plein écran avec un retour « ‹ Maison ». Plus de bottom-tabs — la personne est
// un contexte, la page un contenu. Les liens `#e=` (espaces reçus) restent
// intouchés (court-circuit avant tout rendu applicatif).
type Screen = 'maison' | 'cuisine' | 'nounou' | 'securite';

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const refresh = useStore((s) => s.refresh);
  const [screen, setScreen] = useState<Screen>('maison');
  const [accountOpen, setAccountOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  // Jeton du destinataire à cibler quand on ouvre une page via « Envoyer »
  // (personne = contexte) : la page ouvre sa feuille d'envoi pré-sélectionnée.
  const [shareFor, setShareFor] = useState<string | null>(null);
  const { session } = useSession();
  // Rituel d'adoption (Q1) : quand le foyer rejoint a déjà du contenu cloud, la
  // fusion exige un consentement explicite (jamais silencieuse) + export préalable.
  const [adoptReq, setAdoptReq] = useState<AdoptRequest | null>(null);
  // AS-2b : bandeau « tu as hérité du foyer » (l'ancien owner a supprimé son compte,
  // la propriété a été transférée à cet utilisateur). Affiché une fois, puis acquitté.
  const [ownerNotice, setOwnerNotice] = useState(false);
  useEffect(() => {
    if (!session) return;
    void checkOwnerNotice().then(setOwnerNotice);
  }, [session]);
  // Sync cloud (S3) : non bloquante ; après un pull qui change le local, recharge
  // le store Cuisine ET le doc Nounou (sinon la vue Nounou garderait un doc
  // périmé en mémoire et le ré-écraserait au prochain save — FIX revue Q n°6).
  const onSynced = () => {
    void refresh();
    void useNounou.getState().init();
  };
  useSync(session, onSynced, setAdoptReq);

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
          title="Une page pour…"
          sub="Chaque page arrive déjà remplie — tu ajustes, tu n’écris pas tout."
          onClose={() => setNewPageOpen(false)}
        >
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>🧺</span>
            <span>
              <h4>Entretien</h4>
              <div className="st">Ménage, linge, les standards de ta maison</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>🚗</span>
            <span>
              <h4>Chauffeur</h4>
              <div className="st">Trajets, écoles, véhicules</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-nprow">
            <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 20 }}>💛</span>
            <span>
              <h4>Quelqu’un d’autre</h4>
              <div className="st">Grands-parents, garde du samedi… page libre</div>
            </span>
            <span className="mz-soon">Bientôt</span>
          </div>
          <div className="mz-sm" style={{ marginTop: 12 }}>
            En attendant, ouvre une page <b>Cuisine</b> ou <b>Nounou</b> depuis Maison.
          </div>
        </Sheet>
      )}
      {accountOpen && <AccountSheet session={session} onClose={() => setAccountOpen(false)} />}

      {ownerNotice && (
        <Sheet
          title="Ce foyer est désormais le tien"
          onClose={() => {
            void ackOwnerNotice();
            setOwnerNotice(false);
          }}
        >
          <div className="mz-sm" style={{ marginBottom: 14 }}>
            Tu es désormais responsable de ce foyer. La personne qui le gérait a supprimé son
            compte ; rien n’est perdu — tes menus, tes pages et tes réglages sont intacts et
            continuent normalement. C’est simplement toi qui veilles dessus à présent, et toi
            seul·e peux désormais le supprimer.
          </div>
          <div className="mz-btnrow">
            <button
              className="mz-btn primary"
              onClick={() => {
                void ackOwnerNotice();
                setOwnerNotice(false);
              }}
            >
              J’ai compris
            </button>
          </div>
        </Sheet>
      )}

      {adoptReq && (
        <Sheet
          title="Rejoindre ce foyer ?"
          sub="Ce foyer a déjà du contenu dans le cloud. Ta maison sur cet appareil va le rejoindre : on garde tout, et en cas de doublon c’est la version du foyer qui gagne."
          onClose={() => setAdoptReq(null)}
        >
          <div className="mz-sm" style={{ marginBottom: 12 }}>
            Par précaution, une sauvegarde de tes données locales est téléchargée avant la fusion.
          </div>
          <div className="mz-btnrow">
            <button className="mz-btn" onClick={() => setAdoptReq(null)}>
              Plus tard
            </button>
            <button
              className="mz-btn primary"
              onClick={() => {
                void downloadExport(); // filet Q1 : export AVANT toute première fusion
                adoptReq.proceed();
                setAdoptReq(null);
              }}
            >
              Fusionner nos maisons
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
