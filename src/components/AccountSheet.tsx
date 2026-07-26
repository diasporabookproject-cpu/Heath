import { useEffect, useState } from 'react';
import { Sheet } from '../ui/primitives';
import { getSupabase, signOut, type Session } from '../lib/supabase';
import { clearCompteLie, saveCompteLie } from '../lib/db';
import {
  sendOtp,
  verifyOtp,
  ensureFoyer,
  deleteAccount,
  createInvite,
  acceptInvite,
  leaveFoyer,
  currentFoyerId,
} from '../lib/auth';
import { normalizeOtp, isValidOtp, isValidEmail } from '../lib/otp';
import { downloadExport } from '../lib/exportData';
import { pull } from '../lib/sync/engine';
import Ftue from '../ftue/Ftue';

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
  const [confirmJoin, setConfirmJoin] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // F4 : replay de la FTUE en mode DÉMO (strictement visuel — aucun peuplement,
  // #join sauté) — pour montrer l'app à un tiers sans vider le stockage.
  const [replay, setReplay] = useState(false);

  const doInvite = async () => {
    setBusy(true);
    setErr('');
    const { code, error } = await createInvite();
    setBusy(false);
    if (error) setErr(error);
    else if (code) setInviteCode(code);
  };

  // 1ᵉʳ tap : on n'appelle PAS encore le serveur (opération destructive) → confirmation.
  const doJoin = () => {
    if (!joinCode.trim()) return;
    setErr('');
    setConfirmJoin(true);
  };

  // Confirmé : FILET avant l'opération destructive (A1). Le serveur supprimera le
  // foyer possédé ET sa sauvegarde cloud → on rapatrie d'abord les éventuels docs
  // cloud-only (pull final), puis on exporte en local (filet), puis on rejoint.
  const confirmedJoin = async () => {
    setBusy(true);
    setErr('');
    const fid = await currentFoyerId();
    if (fid) {
      try {
        await pull(fid); // rapatrie les docs cloud-only avant que le foyer ne soit supprimé
      } catch {
        /* best-effort : l'export ci-dessous reste le filet */
      }
    }
    await downloadExport(); // export JSON local AVANT toute suppression (filet Q1)
    const { error } = await acceptInvite(joinCode.trim());
    if (error) {
      setBusy(false);
      setErr(error);
      return;
    }
    // Foyer changé → on recharge pour ré-adopter/synchroniser le foyer rejoint.
    window.location.reload();
  };

  const doLeave = async () => {
    setBusy(true);
    setErr('');
    // FILET (symétrie avec « Rejoindre »/A1) : si tu es owner seul, quitter supprime
    // le foyer ET sa sauvegarde cloud (cascade). On rapatrie d'abord les docs
    // cloud-only (pull) puis on exporte en local AVANT toute suppression.
    const fid = await currentFoyerId();
    if (fid) {
      try {
        await pull(fid);
      } catch {
        /* best-effort : l'export ci-dessous reste le filet */
      }
    }
    await downloadExport();
    const { error } = await leaveFoyer();
    if (error) {
      setBusy(false);
      setErr(error);
      return;
    }
    window.location.reload(); // foyer neuf recréé au rechargement
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
    // T1 : mémoriser LOCALEMENT que le compte est lié — c'est ce drapeau qui ouvre
    // l'app (jamais la session vivante, nulle hors-ligne après expiration du jeton).
    const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
    await saveCompteLie(data.session?.user?.id ?? '', data.session?.user?.email ?? email.trim());
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

  // F4 : replay démo plein écran (recouvre la feuille ; fermer → retour ici).
  if (replay) return <Ftue demo onDone={() => setReplay(false)} />;

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
              await clearCompteLie(); // le mur se referme : le prochain boot demande le compte
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
            Partage-le avec l’autre parent — valable 72 h.
          </div>
        ) : (
          <button className="mz-btn" onClick={doInvite} disabled={busy}>
            ＋ Inviter quelqu’un dans mon foyer
          </button>
        )}
        {!confirmJoin ? (
          <>
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
              Rejoindre un foyer remplace le tien : cet appareil affichera le contenu du
              foyer rejoint. Tes données actuelles restent en ligne dans ton foyer.
            </div>
          </>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="mz-note">
              Ton foyer actuel et sa <b>sauvegarde en ligne seront supprimés</b>. Sur cet
              appareil, <b>le contenu du foyer rejoint remplacera le tien</b> — il n'y a plus
              de fusion. Une copie de tes données va être téléchargée avant, par sécurité.
            </div>
            <div className="mz-btnrow">
              <button className="mz-btn" onClick={() => setConfirmJoin(false)} disabled={busy}>
                Annuler
              </button>
              <button className="mz-btn primary" onClick={confirmedJoin} disabled={busy}>
                {busy ? 'Fusion…' : 'Rejoindre le foyer'}
              </button>
            </div>
          </div>
        )}
        {!confirmLeave ? (
          <button className="mz-quiet" onClick={() => setConfirmLeave(true)}>
            Quitter le foyer partagé
          </button>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="mz-note">
              Tu quittes ce foyer et repars sur une maison neuve. <b>Cet appareil sera vidé de
              son contenu</b> (il suit le nouveau foyer, vide). <b>Si tu es le propriétaire de ce
              foyer, sa sauvegarde en ligne est aussi supprimée.</b> Une copie de tes données va
              être téléchargée avant, par sécurité.
            </div>
            <div className="mz-btnrow">
              <button className="mz-btn" onClick={() => setConfirmLeave(false)} disabled={busy}>
                Annuler
              </button>
              <button className="mz-btn" onClick={doLeave} disabled={busy}>
                {busy ? '…' : 'Quitter le foyer'}
              </button>
            </div>
          </div>
        )}

        <button className="mz-quiet" onClick={() => setReplay(true)}>
          Revoir l’introduction
        </button>
        {!confirmDel ? (
          <button className="mz-quiet" onClick={() => setConfirmDel(true)}>
            Supprimer mon compte
          </button>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div className="mz-note">
              Supprimer ton compte efface tes données du cloud. <b>Si ton foyer a d’autres
              membres, il leur est transféré</b> — la propriété passe au plus ancien, et son
              contenu (menus, pages envoyées) reste en ligne pour eux. <b>Si tu es seul·e dessus,
              le foyer et ses pages envoyées sont supprimés.</b> Ta copie locale reste sur cet
              appareil. Action irréversible.
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
        {/* Lot Identité & accès T1 : « Plus tard — je continue sans compte » est MORT.
            Le compte est requis ; l'app n'a plus de mode sans compte. */}
        <button className="mz-quiet" onClick={() => setReplay(true)}>
          Revoir l’introduction
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
