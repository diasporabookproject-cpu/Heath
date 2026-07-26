import { useEffect, useRef, useState } from 'react';
import './compte.css';
import { signOut, type Session } from '../lib/supabase';
import { clearCompteLie, loadCompteLie, loadMonPrenom, saveMonPrenom, type CompteLie } from '../lib/db';
import { createInvite, deleteAccount, ensureFoyer, leaveFoyer, loadFoyerInfo, type FoyerInfo } from '../lib/auth';
import { downloadExport } from '../lib/exportData';
import { isNative, shareText, webBaseUrl } from '../lib/platform';
import { varianteSuppression, dependants } from './suppression';
import Ftue from '../ftue/Ftue';

/**
 * LA PAGE DE COMPTE (lot Identité & accès, T4) — remplace l'ancienne feuille
 * `AccountSheet`. Une page, deux liens discrets : « Avancé » et « Supprimer mon
 * compte ». Maquette : `identite-ecrans-compiles.html` §3 + `identite-derniers-ecrans.html`.
 *
 * 🔴 Ce que T1 a supprimé d'ici : les étapes « e-mail » et « code ». Derrière le mur,
 * on ne peut PAS être dans l'app sans compte lié — cette feuille n'a donc plus de
 * branche « déconnecté » à porter. Ce qui reste possible est « compte lié, session
 * absente » (hors-ligne, ou jeton expiré) : la page s'affiche entièrement, nomme
 * l'occupant depuis l'appareil, et dit franchement que la sauvegarde attend le réseau.
 * La session revient d'elle-même — le jeton de rafraîchissement n'est pas détruit par
 * un échec réseau ; et « Se déconnecter » reste toujours disponible comme issue.
 *
 * Registre : VOUVOIEMENT.
 */

/** Un état de moins de 300 ms ne s'affiche pas (grammaire des états). */
const BUSY_DELAY_MS = 300;

const IconSortie = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const IconPartage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconExport = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

const IconRejouer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

const IconCorbeille = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
  </svg>
);

const IconMembre = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const IconLienCoupe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const IconMaisonReste = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20h14V9.8" />
  </svg>
);

const IconSortieFoyer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20h6" />
    <path d="m15 16 4-4-4-4" />
    <path d="M19 12h-7" />
  </svg>
);

const IconAlerte = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </svg>
);

/** Le message qui accompagne un code d'invitation (maquette `identite-derniers-ecrans`).
 * ⚠️ Le lien est l'URL WEB RÉELLE de l'app : `manzil.ma` n'est pas acheté, et un lien
 * mort dans un message envoyé serait pire que pas de lien. À remplacer le jour de l'achat. */
export function messageInvitation(code: string, lien: string): string {
  return [
    'Je t’ajoute à la maison sur Manzil — tu pourras voir et modifier les menus, les consignes et l’équipe.',
    '',
    code,
    '',
    'Installe l’app, puis entre ce code quand elle te le demande.',
    lien,
  ].join('\n');
}

export default function ComptePage({ session, onClose }: { session: Session | null; onClose: () => void }) {
  const [vue, setVue] = useState<'page' | 'avance'>('page');
  const [compte, setCompte] = useState<CompteLie | null>(null);
  const [monPrenom, setMonPrenom] = useState<string | null>(null);
  const [info, setInfo] = useState<FoyerInfo | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBusy, setShowBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // F4 : replay de la FTUE en mode DÉMO (visuel, aucun peuplement) — « Revoir l'introduction ».
  const [replay, setReplay] = useState(false);

  const startBusy = () => {
    setBusy(true);
    busyTimer.current = setTimeout(() => setShowBusy(true), BUSY_DELAY_MS);
  };
  const endBusy = () => {
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = null;
    setBusy(false);
    setShowBusy(false);
  };
  useEffect(() => () => { if (busyTimer.current) clearTimeout(busyTimer.current); }, []);

  // Identité de l'appareil : disponible SANS réseau (c'est ce qui tient la page hors-ligne).
  useEffect(() => {
    void loadCompteLie().then(setCompte);
    void loadMonPrenom().then(setMonPrenom);
  }, []);

  // Le foyer, lui, se lit en ligne. Échec = `null` : la page reste entière, sans mentir.
  useEffect(() => {
    if (!session) return;
    void ensureFoyer().then(() => loadFoyerInfo()).then((i) => {
      setInfo(i);
      // Le serveur fait foi sur MON prénom : s'il en a un, on rafraîchit la copie locale.
      const moi = i?.membres.find((m) => m.moi);
      if (moi?.prenom) {
        setMonPrenom(moi.prenom);
        void saveMonPrenom(moi.prenom);
      }
    });
  }, [session]);

  const email = compte?.email ?? session?.user?.email ?? '';
  const initiale = (monPrenom || email || '?').trim().slice(0, 1).toUpperCase();

  const inviter = async () => {
    if (busy) return;
    setErr('');
    startBusy();
    const r = await createInvite();
    endBusy();
    if (r.error || !r.code) {
      return setErr('Le code n’a pas pu être créé. Vérifiez votre connexion, puis réessayez.');
    }
    setCode(r.code);
  };

  const partager = async () => {
    if (!code) return;
    const texte = messageInvitation(code, webBaseUrl());
    try {
      if (isNative) await shareText(texte, 'Inviter dans mon foyer');
      else if (navigator.share) await navigator.share({ text: texte });
      else await navigator.clipboard.writeText(texte);
    } catch {
      /* partage annulé : rien à dire */
    }
  };

  const deconnecter = async () => {
    await signOut();
    await clearCompteLie();
    // Le gate ne se réévalue qu'au boot : on le provoque, sinon on resterait DANS
    // l'app après s'être déconnecté (retour device ①).
    window.location.reload();
  };

  const supprimer = async () => {
    if (busy) return;
    setErr('');
    startBusy();
    const { error } = await deleteAccount();
    if (error) {
      endBusy();
      return setErr('La suppression n’a pas abouti. Vérifiez votre connexion, puis réessayez.');
    }
    // Le compte n'existe plus : le mur doit se refermer immédiatement.
    window.location.reload();
  };

  const quitter = async () => {
    if (busy) return;
    setErr('');
    startBusy();
    const { error } = await leaveFoyer();
    if (error) {
      endBusy();
      return setErr('La sortie n’a pas abouti. Vérifiez votre connexion, puis réessayez.');
    }
    // Foyer neuf au prochain boot ; la purge du cache local est faite par la règle
    // de changement de foyer (T2 : `switch` → purge locale + pull seul).
    window.location.reload();
  };

  if (replay) return <Ftue demo onDone={() => setReplay(false)} />;

  const variante = varianteSuppression(info);
  const coupes = dependants(info);
  const membres = info?.membres ?? [{ userId: 'moi', prenom: monPrenom, moi: true }];
  const nomFondateur = info?.prenomFondateur;

  // ── Avancé — au bout d'un lien discret ────────────────────────────────────
  if (vue === 'avance') {
    // ÉCART À LA MAQUETTE, assumé : « Quitter ce foyer », réservé au MEMBRE. Sans
    // cette porte, quelqu'un qui a rejoint le mauvais foyer devrait SUPPRIMER SON
    // COMPTE pour en sortir. Le fondateur n'y a pas droit (ADR 33 : le foyer est
    // adossé à lui — pour lui, partir c'est supprimer, et c'est l'autre lien).
    const peutQuitter = !!info && !info.jeSuisFondateur;
    return (
      <div className="cp">
        <div className="hd">
          <button className="bk" aria-label="Revenir au compte" onClick={() => setVue('page')}>‹</button>
          <span className="ti">Avancé</span>
        </div>
        <div className="cardw">
          <button className="row" onClick={() => void downloadExport()}>
            <span className="ic"><IconExport /></span>
            <span className="rt"><b>Exporter mes données</b><i>Un fichier à conserver</i></span>
            <span className="cv" aria-hidden>›</span>
          </button>
          <button className="row" onClick={() => setReplay(true)}>
            <span className="ic"><IconRejouer /></span>
            <span className="rt"><b>Revoir l’introduction</b></span>
            <span className="cv" aria-hidden>›</span>
          </button>
          {peutQuitter && (
            <button className="row" onClick={() => { setErr(''); setConfirmQuit(true); }}>
              <span className="ic"><IconSortieFoyer /></span>
              <span className="rt">
                <b>Quitter ce foyer</b>
                <i>Vous gardez votre compte ; le foyer reste intact</i>
              </span>
              <span className="cv" aria-hidden>›</span>
            </button>
          )}
        </div>
        {err && <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>}
        <div className="grow" />

        {confirmQuit && (
          <>
            <button className="cpdim" aria-label="Annuler" onClick={() => { if (!busy) setConfirmQuit(false); }} />
            <div className="cpsheet" role="dialog" aria-modal="true" aria-label="Quitter ce foyer">
              <div className="dic"><IconSortieFoyer /></div>
              <h2>Quitter ce foyer ?</h2>
              <p>
                Vous perdez l’accès à {nomFondateur ? `la maison de ${nomFondateur}` : 'cette maison'} et
                cet appareil sera <b>vidé de son contenu</b>. Votre compte, lui, reste : vous pourrez
                fonder votre propre maison ou entrer un nouveau code.
              </p>
              <div className="keep">
                <div className="kl"><IconMaisonReste /> Le foyer reste — rien n’y est effacé</div>
              </div>
              <button className={'dbtn' + (showBusy ? ' busy' : '')} onClick={() => void quitter()} disabled={busy}>
                {showBusy ? (<><span className="spin" />Sortie…</>) : 'Quitter le foyer'}
              </button>
              <button className="cbtn" onClick={() => setConfirmQuit(false)} disabled={busy}>Annuler</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── La page de compte ─────────────────────────────────────────────────────
  return (
    <div className="cp">
      <div className="hd">
        <button className="bk" aria-label="Fermer le compte" onClick={onClose}>‹</button>
        <span className="ti">Compte</span>
      </div>

      <div className="cardw">
        <div className="idrow">
          <span className="av" aria-hidden>{initiale}</span>
          <span className="it">
            <b>{email}</b>
            <i>{session ? 'Votre foyer est sauvegardé' : 'Sauvegarde en attente de réseau'}</i>
          </span>
        </div>
        <button className="logout" onClick={() => void deconnecter()}>
          <IconSortie /> Se déconnecter
        </button>
      </div>
      <div className="hint">Vous devrez vous reconnecter avec votre e-mail.</div>

      <div className="seclabel">Votre foyer</div>
      <div className="cardw">
        {membres.map((m) => (
          <div className="mrow" key={m.userId}>
            <span className="ma" aria-hidden>{(m.prenom ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="mn">
              {m.prenom ?? 'Sans prénom'} {m.moi && <span>(vous)</span>}
            </span>
          </div>
        ))}
        {code ? (
          <div className="coderow">
            <span className="ct">
              <i>Code d’invitation</i>
              <b>{code}</b>
            </span>
            <button className="sh" onClick={() => void partager()}>
              <IconPartage /> Partager
            </button>
          </div>
        ) : (
          /* Le code NAÎT DU GESTE et vit 24 h — jamais de code permanent affiché ici. */
          <button className="genrow" onClick={() => void inviter()} disabled={busy || !session}>
            <span className="gi">{showBusy ? <span className="spin dark" /> : <IconPlus />}</span>
            <span className="gt2">
              <b>{showBusy ? 'Création du code…' : 'Inviter quelqu’un'}</b>
              <i>{session ? 'Un code à partager, valable 24 h' : 'Disponible dès le retour du réseau'}</i>
            </span>
          </button>
        )}
      </div>
      {err && !confirmDel && (
        <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>
      )}

      <div className="grow" />
      <div className="footlinks">
        <button className="fl" onClick={() => setVue('avance')}>Avancé</button>
        <button className="fl dgr" onClick={() => { setErr(''); setConfirmDel(true); }}>Supprimer mon compte</button>
      </div>

      {confirmDel && (
        <>
          <button className="cpdim" aria-label="Annuler" onClick={() => { if (!busy) setConfirmDel(false); }} />
          <div className="cpsheet" role="dialog" aria-modal="true" aria-label="Supprimer votre compte">
            <div className="dic"><IconCorbeille /></div>
            <h2>Supprimer votre compte ?</h2>

            {variante === 'fondateur' && (
              <>
                <p>Vous avez fondé ce foyer : en partant, <b>vous l’emportez avec vous</b>.</p>
                <div className="impact">
                  {coupes.map((l, i) => (
                    <div className="il" key={i}>
                      {l.includes('page') ? <IconLienCoupe /> : <IconMembre />} {l}
                    </div>
                  ))}
                </div>
              </>
            )}
            {variante === 'seul' && (
              <p>
                Vos menus, vos consignes et votre équipe seront <b>effacés définitivement</b>.
                Cette action ne peut pas être annulée.
              </p>
            )}
            {variante === 'membre' && (
              <>
                <p>
                  Votre compte et votre accès à {nomFondateur ? `la maison de ${nomFondateur}` : 'cette maison'} seront
                  supprimés définitivement.
                </p>
                <div className="keep">
                  <div className="kl"><IconMaisonReste /> Le foyer reste — rien n’y est effacé</div>
                </div>
              </>
            )}
            {variante === 'inconnu' && (
              <p>
                Votre compte sera <b>supprimé définitivement</b>. Cette action ne peut pas être annulée.
              </p>
            )}

            {err && <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>}
            <button className={'dbtn' + (showBusy ? ' busy' : '')} onClick={() => void supprimer()} disabled={busy}>
              {showBusy ? (<><span className="spin" />Suppression…</>) : 'Supprimer définitivement'}
            </button>
            <button className="cbtn" onClick={() => setConfirmDel(false)} disabled={busy}>Annuler</button>
          </div>
        </>
      )}
    </div>
  );
}
