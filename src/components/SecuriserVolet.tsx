import { useState } from 'react';
import { sendOtp, verifyOtp, ensureFoyer } from '../lib/auth';
import { isValidEmail, isValidOtp, normalizeOtp } from '../lib/otp';

// F4-bis fiche B (Lecture 1 — décision PO) : on ne partage PAS sans compte (le
// partage EST l'écriture cloud qui crée le lien durable), mais la création de
// compte devient UNE ÉTAPE DU PARTAGE, dans la MÊME feuille, au vocabulaire
// « sécuriser sa page » — jamais « inscription », « compte » ou « connexion ».
// Briques existantes (OTP e-mail + foyer paresseux), zéro nouveau backend.
// `onDone` relance l'envoi là où il s'était arrêté (l'état de la feuille est intact).

export default function SecuriserVolet({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const sendCode = async () => {
    if (!isValidEmail(email)) return setErr('E-mail invalide.');
    setBusy(true);
    setErr('');
    const { error } = await sendOtp(email);
    setBusy(false);
    if (error) return setErr(error);
    setStep('code');
  };

  const verify = async () => {
    if (!isValidOtp(code)) return setErr('Entre le code à 6 chiffres reçu par e-mail.');
    setBusy(true);
    setErr('');
    const { error } = await verifyOtp(email, code);
    if (error) {
      setBusy(false);
      return setErr('Code incorrect ou expiré.');
    }
    await ensureFoyer(); // 1ʳᵉ fois : crée le foyer — le lien a désormais où vivre
    setBusy(false);
    onDone(); // l'envoi repart tout seul, même geste
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <div className="cz-blab" style={{ marginTop: 2 }}>Sécurisez votre page pour créer son lien</div>
      <div className="cz-review" style={{ margin: '6px 0 12px' }}>
        {step === 'email'
          ? 'Votre lien doit vivre quelque part de sûr. Votre e-mail, un code à 6 chiffres — c’est tout.'
          : `On a envoyé un code à 6 chiffres à ${email}.`}
      </div>
      {step === 'email' ? (
        <input
          className="cz-inp"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@exemple.com"
        />
      ) : (
        <input
          className="cz-inp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(normalizeOtp(e.target.value))}
          placeholder="000000"
        />
      )}
      {err && <div className="cz-estnote" style={{ marginTop: 8 }}>{err}</div>}
      {step === 'email' ? (
        <button className="cz-cta" onClick={() => void sendCode()} disabled={busy || !email.trim()}>
          {busy ? 'Envoi…' : 'Recevoir mon code'}
        </button>
      ) : (
        <button className="cz-cta" onClick={() => void verify()} disabled={busy || !isValidOtp(code)}>
          {busy ? 'Vérification…' : 'Valider et envoyer'}
        </button>
      )}
      <button
        style={{
          display: 'block',
          width: '100%',
          marginTop: 10,
          padding: 8,
          background: 'none',
          border: 'none',
          font: 'inherit',
          fontSize: 13,
          fontWeight: 500,
          color: '#8a8072',
          cursor: 'pointer',
        }}
        onClick={step === 'email' ? onCancel : () => { setStep('email'); setCode(''); setErr(''); }}
      >
        {step === 'email' ? 'Plus tard' : 'Changer d’e-mail'}
      </button>
    </div>
  );
}
