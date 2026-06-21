import { useState } from 'react';
import { sendMagicLink, signOut, type Session } from '../lib/supabase';

// Connexion par lien magique (e-mail). La connexion est facultative :
// l'app marche en local sans compte ; se connecter active la synchro et
// l'audio dans les liens partagés.

export default function AccountSheet({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const send = async () => {
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setStatus('error');
      setMsg(error);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>Compte & synchro</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        <div className="sheet__list">
          {session ? (
            <>
              <p className="hint">
                Connecté en tant que <b>{session.user.email}</b>. Tes données peuvent se
                synchroniser et les notes vocales s'intègrent aux liens partagés.
              </p>
              <button
                className="btn btn--ghost"
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <p className="hint">
                Connecte-toi avec ton e-mail (lien magique, sans mot de passe) pour synchroniser
                tes menus entre appareils et partager les notes vocales.
              </p>
              <div className="field">
                <label>E-mail</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                />
              </div>
              {status === 'sent' ? (
                <div className="import-report">
                  ✓ Lien envoyé à <b>{email}</b>. Ouvre ta boîte mail et clique le lien depuis cet
                  appareil.
                </div>
              ) : (
                <>
                  {status === 'error' && (
                    <div className="import-report import-report--warn">{msg}</div>
                  )}
                  <button
                    className="btn"
                    onClick={send}
                    disabled={status === 'sending' || !email.trim()}
                  >
                    {status === 'sending' ? 'Envoi…' : 'Recevoir le lien de connexion'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
