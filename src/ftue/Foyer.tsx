import { useEffect, useRef, useState } from 'react';
import './entrer.css';
import { acceptInvite, previewInvite, savePrenom } from '../lib/auth';
import { isValidInviteCode, normalizeInviteCode, INVITE_CODE_LEN } from '../lib/otp';
import { clearCodeEnAttente, loadCodeEnAttente, saveFtueDone, saveRolesActifs } from '../lib/db';

/**
 * ÉCRAN 2 — « Le foyer » (lot Identité & accès, T3).
 * Après le compte : fonder sa maison, ou rejoindre celle de quelqu'un.
 * Maquettes : `identite-ecrans-compiles.html` §2 + `identite-derniers-ecrans.html`.
 *
 * 🔴 BIFURCATION DE PARCOURS (décision UI a) : **celui qui rejoint saute la FTUE**.
 * Le foyer existe déjà — lui faire choisir des domaines et nommer une équipe
 * écraserait le travail du fondateur. L'écran d'arrivée REMPLACE la FTUE pour lui.
 *
 * Le prénom est demandé ici (décision PO ①, option A) : au fondateur quand il crée
 * sa maison, au membre quand il arrive. Sans lui, « Maison d'Amine », « Sofia » et
 * « Sofia perd l'accès » ne sont pas calculables — le produit ne connaissait AUCUN
 * nom d'utilisateur avant `0014`.
 */

const BUSY_DELAY_MS = 300; // un état de moins de 300 ms ne s'affiche pas

const IconMaison = () => (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.8V20h14V9.8" /><path d="M10 20v-5h4v5" />
  </svg>
);
const IconAlerte = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" />
  </svg>
);

/** « créée en mai » — le mois en toutes lettres, comme la maquette. */
function moisDe(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'long' });
}

interface Maison {
  prenomFondateur: string | null;
  nbMembres: number;
  createdAt?: string;
}

export default function Foyer({ onFonder, onRejoint }: { onFonder: () => void; onRejoint: () => void }) {
  // `attente` = on rejoue un code saisi AVANT l'authentification (parcours invité
  // inversé) : l'écran ne propose alors pas « fonder », il nomme la maison.
  const [step, setStep] = useState<'attente' | 'choix' | 'code' | 'trouve' | 'arrivee'>('attente');
  const [prenom, setPrenom] = useState('');
  const [code, setCode] = useState('');
  const [maison, setMaison] = useState<Maison | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBusy, setShowBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const startBusy = () => { setBusy(true); timer.current = setTimeout(() => setShowBusy(true), BUSY_DELAY_MS); };
  const endBusy = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setBusy(false); setShowBusy(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Au montage : un code saisi avant la session ? On le vérifie MAINTENANT (la
  // session existe, `preview_invite` est appelable) et on nomme la maison. Sinon,
  // parcours normal : le choix (fonder / rejoindre).
  useEffect(() => {
    void (async () => {
      const enAttente = await loadCodeEnAttente();
      if (!enAttente) return setStep('choix');
      setCode(enAttente);
      const r = await previewInvite(enAttente);
      if (!r.ok) {
        // Code mort (expiré, déjà utilisé, faux) : on ne le garde pas et on le dit
        // sur l'écran du choix — la personne peut redemander un code ou fonder.
        await clearCodeEnAttente();
        setErr(r.error ? 'La vérification n’a pas abouti. Vérifiez votre connexion, puis réessayez.'
                       : 'Ce code n’est plus valide. Demandez-en un nouveau, ou créez votre maison.');
        return setStep('choix');
      }
      setMaison({ prenomFondateur: r.prenomFondateur ?? null, nbMembres: r.nbMembres ?? 1, createdAt: r.createdAt });
      setStep('trouve');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fonder : on pose le prénom, la FTUE prend la suite ────────────────────
  const fonder = async () => {
    if (busy || !prenom.trim()) return;
    startBusy();
    await savePrenom(prenom); // best-effort : un échec réseau ne bloque pas l'entrée
    endBusy();
    onFonder();
  };

  // ── Rejoindre : preview (lecture seule) → confirmation → accept ───────────
  const verifierCode = async (v: string) => {
    if (busy) return;
    setErr('');
    startBusy();
    const r = await previewInvite(v);
    endBusy();
    if (!r.ok) {
      setErr(r.error ? 'La vérification n’a pas abouti. Vérifiez votre connexion, puis réessayez.'
                     : 'Ce code n’est pas valide. Vérifiez-le, ou demandez-en un nouveau.');
      return;
    }
    setMaison({ prenomFondateur: r.prenomFondateur ?? null, nbMembres: r.nbMembres ?? 1, createdAt: r.createdAt });
    setStep('trouve');
  };

  const rejoindre = async () => {
    if (busy) return;
    setErr('');
    startBusy();
    const { error } = await acceptInvite(code);
    endBusy();
    if (error) return setErr(error);
    await clearCodeEnAttente(); // consommé : il ne doit plus être rejoué
    setPrenom('');
    setStep('arrivee');
  };

  // ── Entrer (membre) : prénom + on SAUTE la FTUE ───────────────────────────
  const entrer = async () => {
    if (busy || !prenom.trim()) return;
    startBusy();
    await savePrenom(prenom);
    // La maison est déjà installée : on pose `ftueDone` (elle ne doit jamais se
    // présenter au membre) et on active les deux cartes du hub — leur contenu
    // arrive du foyer au premier cycle de sync (purge locale + pull).
    await saveFtueDone();
    await saveRolesActifs(['cuisine', 'nounou']);
    endBusy();
    onRejoint();
  };

  const nomMaison = maison?.prenomFondateur ? `Maison de ${maison.prenomFondateur}` : 'Cette maison';
  const initiale = (maison?.prenomFondateur ?? '?').slice(0, 1).toUpperCase();

  // Vérification du code en attente : ~une requête. Rien à l'écran (pas de flash).
  if (step === 'attente') return <div className="en" />;

  // ── ② Le choix ────────────────────────────────────────────────────────────
  if (step === 'choix') {
    return (
      <div className="en">
        <span className="mark"><IconMaison /></span>
        <h1>Créons<br />votre maison.</h1>
        <div className="sub">Vos menus, vos consignes, votre équipe — au même endroit.</div>
        {/* Ajout imposé par la décision ① (option A) : la maquette ne porte pas ce
            champ, mais sans prénom « Maison d'Amine » et la liste des membres ne
            peuvent pas exister. Même vocabulaire visuel que l'Écran 1. */}
        <input
          className="inp"
          type="text"
          autoComplete="given-name"
          placeholder="Votre prénom"
          value={prenom}
          disabled={busy}
          onChange={(e) => setPrenom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void fonder(); }}
          aria-label="Votre prénom"
        />
        <button className={'cta' + (showBusy ? ' busy' : '')} onClick={() => void fonder()} disabled={busy || !prenom.trim()}>
          {showBusy ? (<><span className="spin" />Un instant…</>) : 'Commencer'}
        </button>
        {err && <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>}
        <button className="joinlink" onClick={() => { setErr(''); setCode(''); setStep('code'); setTimeout(() => codeRef.current?.focus(), 50); }}>
          J’ai un code d’invitation
          <span>Quelqu’un de la maison vous l’a envoyé</span>
        </button>
        <div className="grow" />
      </div>
    );
  }

  // ── Saisir le code ────────────────────────────────────────────────────────
  if (step === 'code') {
    const chars = code.split('');
    return (
      <div className="en">
        <div className="bkrow">
          <button className="bk" aria-label="Revenir" onClick={() => { if (!busy) setStep('choix'); }}>‹</button>
        </div>
        <h2>Votre code<br />d’invitation.</h2>
        <div className="cs">Demandez-le à la personne qui gère la maison.</div>
        <div className="codewrap">
          {/* ⚠️ DIX cases, pas six : la maquette montre « 4K7P2M » (6) mais le vrai
              code fait 10 signes (`functions/invite`). La longueur ne peut pas
              bouger — la décision d'accepter `preview_invite` sans rate-limit
              repose dessus (2⁴⁹). Deux rangées de 5 gardent la grammaire des cases. */}
          {[0, 5].map((offset) => (
            <div className="boxes" key={offset} style={offset ? { marginTop: 7 } : undefined}>
              {Array.from({ length: 5 }, (_, i) => {
                const idx = offset + i;
                return (
                  <div key={idx} className={'box' + (err ? ' err' : showBusy ? ' lock' : idx === chars.length ? ' cur' : '')}>
                    {chars[idx] ?? ''}
                  </div>
                );
              })}
            </div>
          ))}
          <input
            ref={codeRef}
            className="codeinput"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={INVITE_CODE_LEN}
            value={code}
            disabled={busy}
            onChange={(e) => {
              const v = normalizeInviteCode(e.target.value);
              setCode(v);
              if (err) setErr('');
              if (isValidInviteCode(v)) void verifierCode(v);
            }}
            aria-label="Code d’invitation à 10 signes"
          />
        </div>
        {err && <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>}
        {showBusy && <div className="checking"><span className="spin dark" />Vérification…</div>}
        <div className="grow" />
      </div>
    );
  }

  // ── C'est bien cette maison ? ─────────────────────────────────────────────
  if (step === 'trouve') {
    const sousTitre = [
      `${maison?.nbMembres ?? 1} personne${(maison?.nbMembres ?? 1) > 1 ? 's' : ''}`,
      moisDe(maison?.createdAt) && `créée en ${moisDe(maison?.createdAt)}`,
    ].filter(Boolean).join(' · ');
    return (
      <div className="en">
        <div className="bkrow">
          <button className="bk" aria-label="Revenir" onClick={() => { if (!busy) setStep('code'); }}>‹</button>
        </div>
        <h2>C’est bien<br />cette maison ?</h2>
        <div className="found">
          <span className="fa">{initiale}</span>
          <span className="ft"><b>{nomMaison}</b><i>{sousTitre}</i></span>
        </div>
        {err && <div className="errline" role="alert"><IconAlerte /><p>{err}</p></div>}
        <button className={'cta' + (showBusy ? ' busy' : '')} onClick={() => void rejoindre()} disabled={busy}>
          {showBusy ? (<><span className="spin" />Un instant…</>) : 'Rejoindre cette maison'}
        </button>
        <button className="notthis" onClick={() => { if (!busy) { setCode(''); setErr(''); setStep('code'); } }}>
          Ce n’est pas ça
        </button>
        <div className="grow" />
      </div>
    );
  }

  // ── L'arrivée du membre (REMPLACE la FTUE) ────────────────────────────────
  return (
    <div className="en">
      <span className="mark"><IconMaison /></span>
      <h1>Vous voilà<br />{maison?.prenomFondateur ? `chez ${maison.prenomFondateur}.` : 'chez vous.'}</h1>
      <div className="sub">La maison est déjà installée : ses menus, ses consignes et son équipe sont là.</div>
      <div className="peek">
        <div className="pk"><div className="pe">🍽️</div><div className="pn">Cuisine</div></div>
        <div className="pk"><div className="pe">👶</div><div className="pn">Nounou</div></div>
        <div className="pk"><div className="pe">🛡️</div><div className="pn">Sécurité</div></div>
      </div>
      <input
        className="inp"
        type="text"
        autoComplete="given-name"
        placeholder="Votre prénom"
        value={prenom}
        disabled={busy}
        onChange={(e) => setPrenom(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void entrer(); }}
        aria-label="Votre prénom"
      />
      <button className={'cta' + (showBusy ? ' busy' : '')} onClick={() => void entrer()} disabled={busy || !prenom.trim()}>
        {showBusy ? (<><span className="spin" />Un instant…</>) : 'Entrer'}
      </button>
      <div className="grow" />
    </div>
  );
}
