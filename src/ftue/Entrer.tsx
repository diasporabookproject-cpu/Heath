import { useEffect, useRef, useState } from 'react';
import './entrer.css';
import { sendOtp, verifyOtp } from '../lib/auth';
import { getSupabase } from '../lib/supabase';
import { isValidEmail, isValidOtp, normalizeOtp } from '../lib/otp';
import { saveCompteLie } from '../lib/db';

/**
 * ÉCRAN 1 — « Entrer » (lot Identité & accès, T1).
 * Le compte est REQUIS dès le premier lancement : cet écran précède tout, sauf un
 * lien reçu par le personnel (le gate `Boot` teste le jeton d'espace AVANT lui).
 * AUCUNE échappatoire : ni « plus tard », ni mode invité.
 *
 * Méthode INCHANGÉE (`sendOtp`/`verifyOtp`) — ce lot change QUAND le compte est
 * demandé, pas comment. Au succès on pose le drapeau local `compteLie` : c'est LUI
 * qui ouvre l'app, jamais la session vivante (sinon l'app enferme dehors hors-ligne).
 *
 * Registre : VOUVOIEMENT (l'Écran 1 est la première surface du produit).
 * Maquette : docs/maquettes/identite-ecrans-compiles.html §1.
 */

/** Un état de moins de 300 ms ne s'affiche pas — un clignotement fatigue plus qu'il ne rassure. */
const BUSY_DELAY_MS = 300;

const IconMaison = () => (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20h14V9.8" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

const IconAlerte = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </svg>
);

export default function Entrer({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  // `busy` = un appel est en cours (verrouille) ; `showBusy` = on l'AFFICHE (≥ 300 ms).
  const [busy, setBusy] = useState(false);
  const [showBusy, setShowBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

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

  const send = async () => {
    if (busy || !isValidEmail(email)) return setErr('Cette adresse ne semble pas valide.');
    setErr('');
    startBusy();
    const { error } = await sendOtp(email.trim());
    endBusy();
    if (error) {
      // Jamais le message brut de Supabase (« Failed to fetch ») : une phrase française.
      return setErr('L’envoi n’a pas abouti. Vérifiez votre connexion, puis réessayez.');
    }
    setCode('');
    setStep('code');
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const verify = async (value: string) => {
    if (busy) return;
    setErr('');
    startBusy();
    const { error } = await verifyOtp(email.trim(), value);
    if (error) {
      endBusy();
      setErr('Ce code n’est pas valide. Vérifiez-le ou demandez-en un nouveau.');
      return;
    }
    // Session fraîche : lecture LOCALE (getSession ne touche pas le réseau ici).
    const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
    const user = data.session?.user;
    await saveCompteLie(user?.id ?? '', user?.email ?? email.trim());
    endBusy();
    onDone();
  };

  const onCodeChange = (raw: string) => {
    const v = normalizeOtp(raw).slice(0, 6);
    setCode(v);
    if (err) setErr('');
    if (isValidOtp(v)) void verify(v); // valide au 6ᵉ chiffre — pas de bouton à presser
  };

  // ── Étape e-mail ──────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <div className="en">
        <span className="mark"><IconMaison /></span>
        <h1>Bienvenue<br />chez vous.</h1>
        <div className="sub">Un e-mail, un code.<br />Pas de mot de passe à retenir.</div>
        <input
          className="inp"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="prenom@exemple.com"
          value={email}
          disabled={busy}
          onChange={(e) => { setEmail(e.target.value); if (err) setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          aria-label="Votre adresse e-mail"
        />
        {err && (
          <div className="errline" role="alert">
            <IconAlerte />
            <p>{err}</p>
          </div>
        )}
        <button className={'cta' + (showBusy ? ' busy' : '')} onClick={() => void send()} disabled={busy || !email.trim()}>
          {showBusy ? (<><span className="spin" />Envoi du code…</>) : 'Continuer'}
        </button>
        <div className="grow" />
        <div className="fine">En continuant, vous acceptez nos conditions et notre politique de confidentialité.</div>
      </div>
    );
  }

  // ── Étape code ────────────────────────────────────────────────────────────
  const chars = code.split('');
  return (
    <div className="en">
      <div className="bkrow">
        <button
          className="bk"
          aria-label="Revenir à l’adresse e-mail"
          onClick={() => { if (busy) return; setStep('email'); setCode(''); setErr(''); }}
        >
          ‹
        </button>
      </div>
      <h2>Votre code<br />est parti.</h2>
      <div className="cs">Envoyé à <b>{email.trim()}</b></div>

      <div className="codewrap">
        <div className="boxes">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={'box' + (err ? ' err' : showBusy ? ' lock' : i === chars.length ? ' cur' : '')}
            >
              {chars[i] ?? ''}
            </div>
          ))}
        </div>
        <input
          ref={codeRef}
          className="codeinput"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          disabled={busy}
          onChange={(e) => onCodeChange(e.target.value)}
          aria-label="Code à 6 chiffres reçu par e-mail"
        />
      </div>

      {err && (
        <div className="errline" role="alert">
          <IconAlerte />
          <p>{err}</p>
        </div>
      )}
      {showBusy ? (
        <div className="checking"><span className="spin dark" />Vérification…</div>
      ) : (
        <button className="resend" onClick={() => void send()} disabled={busy}>
          Renvoyer le code
        </button>
      )}
      <div className="grow" />
    </div>
  );
}
