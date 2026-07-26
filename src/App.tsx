import { useEffect, useRef, useState } from 'react';
import Em from './ui/Em';
import { useStore } from './store/useStore';
import MaisonView from './maison/MaisonView';
import CuisineView from './cuisine/CuisineView';
import NounouView from './nounou/NounouView';
import SecuriteView from './views/SecuriteView';
import EspaceView from './views/EspaceView';
import MzDemo from './ui/MzDemo';
import ComptePage from './compte/ComptePage';
import Pastille, { initialeDe } from './ui/Pastille';
import { Sheet } from './ui/primitives';
import { readEspaceToken } from './lib/espace';
import { supabaseEnabled } from './lib/supabase';
import { isNative, onBackButton, minimizeApp } from './lib/platform';
import { closeTopSheet } from './ui/primitives';
import { loadCompteLie, loadMonPrenom, loadRolesActifs, saveRolesActifs, type RoleActif } from './lib/db';
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
  // T4 : l'accès au compte est une PASTILLE D'INITIALE, la même partout. Elle ne
  // porte plus d'état de connexion — derrière le mur (T1) il y a toujours un compte
  // lié, et « hors-ligne » n'est pas « déconnecté » : la session vivante est nulle
  // hors-ligne dès que le jeton d'accès a expiré. L'initiale se lit donc en LOCAL
  // (prénom, sinon e-mail du compte lié), jamais dans la session.
  const [initiale, setInitiale] = useState('?');
  useEffect(() => {
    void Promise.all([loadCompteLie(), loadMonPrenom()]).then(([c, p]) =>
      setInitiale(initialeDe(p, c?.email)),
    );
  }, [session, accountOpen]);
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
  // (Le bandeau d'héritage de foyer est MORT avec ADR 33 : la propriété ne se
  // transfère plus, le foyer ne survit pas à son titulaire — 0012 a retiré
  // `owner_notice` et `ack_owner_notice` de la base.)
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
          initiale={initiale}
          rolesActifs={rolesActifs}
        />
      ) : screen === 'cuisine' ? (
        !ready ? (
          <div className="spinner">Chargement…</div>
        ) : (
          <CuisineView
            showAccount={supabaseEnabled}
            initiale={initiale}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={back}
            initialShareToken={shareFor ?? undefined}
            onConsumeShare={() => setShareFor(null)}
          />
        )
      ) : screen === 'nounou' ? (
        <NounouView
          showAccount={supabaseEnabled}
          initiale={initiale}
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
              <Pastille initiale={initiale} onClick={() => setAccountOpen(true)} hostClass="account-btn" />
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
          sub="Chaque page arrive déjà remplie — vous ajustez, vous n’écrivez pas tout."
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
              <div className="st">Ménage, linge, les standards de votre maison</div>
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
      {accountOpen && <ComptePage session={session} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
