import { useEffect, useRef, useState } from 'react';
import Em from './ui/Em';
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
import { isNative, onBackButton, minimizeApp } from './lib/platform';
import { closeTopSheet } from './ui/primitives';
import { loadCompteLie, loadRolesActifs, saveRolesActifs, type RoleActif } from './lib/db';
import { useSession } from './lib/useSession';
import { useSync } from './lib/sync/useSync';
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
  // T1 (Identité & accès) : « hors-ligne » n'est PAS « déconnecté ». La session
  // vivante est nulle hors-ligne dès que le jeton d'accès a expiré ; l'affordance
  // compte doit suivre le COMPTE LIÉ (drapeau local), sinon l'en-tête proposerait
  // de « se connecter » à quelqu'un qui l'est déjà et n'a qu'un problème de réseau.
  const [compteLie, setCompteLie] = useState(false);
  useEffect(() => {
    void loadCompteLie().then((c) => setCompteLie(!!c));
  }, [session]);
  const connected = !!session || compteLie;
  // F4 (Flow FTUE) : rôles ACTIVÉS (cartes posées sur le hub) — méta locale, posée
  // par la FTUE, la migration one-shot (appareils existants) ou le « ＋ » ci-dessous.
  const [rolesActifs, setRolesActifs] = useState<RoleActif[]>([]);
  useEffect(() => {
    void loadRolesActifs().then(setRolesActifs);
  }, []);
  const activateRole = (r: RoleActif) => {
    const next = rolesActifs.includes(r) ? rolesActifs : [...rolesActifs, r];
    setRolesActifs(next);
    void saveRolesActifs(next);
  };
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
  useSync(session, onSynced);

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

  // B3 (coquille) : bouton retour Android — priorité ① fermer la feuille la plus
  // haute (pile globale, cf. primitives), ② écran de rôle → revenir à Maison,
  // ③ déjà sur Maison → MINIMISER (jamais de kill : l'app reste chaude).
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    if (!isNative) return;
    return onBackButton(() => {
      if (closeTopSheet()) return;
      if (screenRef.current !== 'maison') {
        setScreen('maison');
        setShareFor(null);
        return;
      }
      void minimizeApp();
    });
  }, []);

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
          rolesActifs={rolesActifs}
        />
      ) : screen === 'cuisine' ? (
        !ready ? (
          <div className="spinner">Chargement…</div>
        ) : (
          <CuisineView
            showAccount={supabaseEnabled}
            connected={connected}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={back}
            initialShareToken={shareFor ?? undefined}
            onConsumeShare={() => setShareFor(null)}
          />
        )
      ) : screen === 'nounou' ? (
        <NounouView
          showAccount={supabaseEnabled}
          connected={connected}
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
                title={connected ? 'Compte et synchro' : 'Se connecter'}
              >
                {connected ? '☁︎' : '☁︎ Connexion'}
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
          {/* F4 : le « ＋ » est LE chemin d'activation post-FTUE — sans lui, « rien
              coché » à la FTUE serait un cul-de-sac (aucune carte, aucun moyen d'en poser). */}
          {(['cuisine', 'nounou'] as RoleActif[])
            .filter((r) => !rolesActifs.includes(r))
            .map((r) => (
              <div
                className="mz-nprow"
                key={r}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  activateRole(r);
                  setNewPageOpen(false);
                }}
              >
                <span className="mz-tav" style={{ background: '#F1EFE8' }}>
                  <Em ch={r === 'cuisine' ? '🥘' : '🧸'} size={22} />
                </span>
                <span>
                  <h4>{r === 'cuisine' ? 'Cuisine' : 'Nounou'}</h4>
                  <div className="st">
                    {r === 'cuisine'
                      ? 'Menus de la semaine, quantités, liste de courses'
                      : 'Planning des enfants, consignes, qui les récupère'}
                  </div>
                </span>
                <span className="chev">›</span>
              </div>
            ))}
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

    </div>
  );
}
