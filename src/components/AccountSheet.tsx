import { useEffect, useState } from 'react';
import { Sheet } from '../ui/primitives';
import { signOut, type Session } from '../lib/supabase';
import { sendOtp, verifyOtp, ensureFoyer, deleteAccount, createInvite, acceptInvite } from '../lib/auth';
import { normalizeOtp, isValidOtp, isValidEmail } from '../lib/otp';
import { downloadExport } from '../lib/exportData';

// Écran Compte (S2). Connexion par CODE e-mail à 6 chiffres (jamais bloquante :
// l'app marche sans compte). Se connecter = mettre sa maison à l'abri (sauvegarde,
// multi-appareil). Inclut export JSON, déconnexion et suppression de compte
// (exigence Apple 5.1.1(v)). Identité = compte Manzil.

export default function AccountSheet({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const doInvite = async () => {
    setBusy(true);
    setErr('');
    const { code, error } = await createInvite();
    setBusy(false);
    if (error) setErr(error);
    else if (code) setInviteCode(code);
  };

  const doJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setErr('');
    const { error } = await acceptInvite(joinCode.trim());
    if (error) {
      setBusy(false);
      setErr(error);
      return;
    }
    // Foyer changé → on recharge pour ré-adopter/synchroniser le foyer rejoint.
    window.location.reload();
  };

  // Foyer paresseux : garantit qu'un utilisateur connecté a bien son foyer
  // (idempotent). Couvre aussi les anciennes sessions (lien magique) sans foyer.
  useEffect(() => {
    if (session) void ensureFoyer();
  }, [session]);

  const send = async () => {
    if (!isValidEmail(email)) {
      setErr('E-mail invalide.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await sendOtp(email);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    if (!isValidOtp(code)) {
      setErr('Entre le code à 6 chiffres.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await verifyOtp(email, code);
    if (error) {
      setBusy(false);
      setErr('Code incorrect ou expiré.');
      return;
    }
    await ensureFoyer(); // crée le foyer à la 1ʳᵉ connexion
    setBusy(false);
    // La session se met à jour globalement (onAuthStateChange) → vue « connecté ».
  };

  const remove = async () => {
    setBusy(true);
    setErr('');
    const { error } = await deleteAccount();
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    onClose();
  };

  // ── Connecté ────────────────────────────────────────────────────────────
  if (session) {
    return (
      <Sheet title="Ta maison est à l'abri" onClose={onClose}>
        <div className="mz-sm" style={{ marginBottom: 14 }}>
          Connectée en tant que <b>{session.user.email}</b>. Tes menus, recettes et pages sont
          sauvegardés et te suivent sur tes appareils.
        </div>

        <div className="mz-btnrow">
          <button className="mz-btn" onClick={() => void downloadExport()}>
            ⬇ Exporter mes données
          </button>
          <button
            className="mz-btn"
            onClick={async () => {
              await signOut();
              onClose();
            }}
          >
            Se déconnecter
          </button>
        </div>

        {/* Foyer partagé (S4) : inviter un 2ᵉ parent / rejoindre un foyer. */}
        <div className="mz-lbl" style={{ marginTop: 18 }}>Foyer partagé</div>
        {inviteCode ? (
          <div className="mz-acc-ok">
            Code d’invitation : <b style={{ letterSpacing: '0.12em' }}>{inviteCode}</b>
            <br />
            Partage-le avec l’autre parent — valable 7 jours.
          </div>
        ) : (
          <button className="mz-btn" onClick={doInvite} disabled={busy}>
            ＋ Inviter quelqu’un dans mon foyer
          </button>
        )}
        <div className="mz-btnrow" style={{ marginTop: 8 }}>
          <input
            className="mz-inp"
            style={{ flex: 2 }}
            type="text"
            autoCapitalize="characters"
            placeholder="J’ai un code…"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button className="mz-btn" style={{ flex: 1 }} onClick={doJoin} disabled={busy || !joinCode.trim()}>
            Rejoindre
          </button>
        </div>
        <div className="mz-sm" style={{ marginTop: 6 }}>
          Rejoindre un foyer remplace le tien ; tes recettes locales le rejoignent à la synchro.
        </div>

        {!confirmDel ? (
          <button className="mz-quiet" onClick={() => setConfirmDel(true)}>
            Supprimer mon compte
          </button>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div className="mz-note">
              Supprimer ton compte efface tes données du cloud et, si tu es propriétaire du foyer,
              <b> coupe les pages déjà envoyées</b>. Ta copie locale reste sur cet appareil. Action
              irréversible.
            </div>
            <div className="mz-btnrow">
              <button className="mz-btn" onClick={() => setConfirmDel(false)} disabled={busy}>
                Annuler
              </button>
              <button className="mz-btn danger" onClick={remove} disabled={busy}>
                {busy ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        )}
        {err && <div className="mz-note" style={{ marginTop: 10 }}>{err}</div>}
      </Sheet>
    );
  }

  // ── Étape e-mail ─────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <Sheet
        title="Mets ta maison à l'abri"
        sub="Sauvegardée, sur tous tes appareils. Un simple e-mail, sans mot de passe."
        onClose={onClose}
      >
        <div className="mz-lbl">Ton e-mail</div>
        <input
          className="mz-inp"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
        />
        {err && <div className="mz-note" style={{ marginTop: 10 }}>{err}</div>}
        <div className="mz-btnrow">
          <button className="mz-btn primary" onClick={send} disabled={busy || !email.trim()}>
            {busy ? 'Envoi…' : 'Recevoir mon code'}
          </button>
        </div>
        <button className="mz-quiet" onClick={onClose}>
          Plus tard — je continue sans compte
        </button>
      </Sheet>
    );
  }

  // ── Étape code ───────────────────────────────────────────────────────────
  return (
    <Sheet
      title="Entre ton code"
      sub={`On a envoyé un code à 6 chiffres à ${email}.`}
      onClose={onClose}
    >
      <input
        className="mz-inp code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(normalizeOtp(e.target.value))}
        placeholder="000000"
      />
      {err && <div className="mz-note" style={{ marginTop: 10 }}>{err}</div>}
      <div className="mz-btnrow">
        <button className="mz-btn primary" onClick={verify} disabled={busy || !isValidOtp(code)}>
          {busy ? 'Vérification…' : 'Me connecter'}
        </button>
      </div>
      <button
        className="mz-quiet"
        onClick={() => {
          setStep('email');
          setCode('');
          setErr('');
        }}
      >
        Changer d'e-mail
      </button>
    </Sheet>
  );
}
