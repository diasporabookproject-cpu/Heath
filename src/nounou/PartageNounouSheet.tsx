import { useEffect, useMemo, useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconPlusThin } from './icons';
import { qrSvg } from '../lib/qr';
import { publishNounouEspace } from './partage';
import { buildEspaceUrl, lastEspaceOpen, revokeEspace } from '../lib/espace';
import { getSupabase, supabaseEnabled } from '../lib/supabase';
import SecuriserVolet from '../components/SecuriserVolet';
import { buildNounouDigest, type NounouScope } from '../maison/digest';
import { DigestBlock, type ScopeOption } from '../ui/DigestBlock';
import { rappelLabel } from '../lib/rappel';
import RappelSheet from '../cuisine/RappelSheet';
import { useStore } from '../store/useStore';
import { todayISO, addDaysISO } from './dates';
import { cleanText } from '../lib/sanitize';
import { isNative, shareText } from '../lib/platform';
import { NOUNOU_LANGS, type NounouDest, type NounouLangue, type Ponctuel } from '../types';

const digits = (s?: string) => (s ?? '').replace(/\D/g, '');

// FN4.1 + FN4.3 — langue par destinataire + lien durable scopé + QR + WhatsApp + accusé.

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'il y a moins d’une heure';
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

export default function PartageNounouSheet({
  onClose,
  onTraduire,
  toast,
  initialToken,
}: {
  onClose: () => void;
  onTraduire: (langue: NounouLangue) => void;
  toast: (m: string) => void;
  /** Destinataire à pré-sélectionner (ouverture ciblée depuis « Envoyer » de Maison). */
  initialToken?: string;
}) {
  const doc = useNounou((s) => s.doc);
  const upsertDest = useNounou((s) => s.upsertDest);
  const removeDest = useNounou((s) => s.removeDest);

  const [selId, setSelId] = useState<string>(
    (initialToken ? doc.destinataires.find((d) => d.token === initialToken)?.id : undefined) ??
      doc.destinataires[0]?.id ??
      '',
  );
  const [adding, setAdding] = useState(doc.destinataires.length === 0);
  const [newName, setNewName] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // F4-bis fiche B : volet « Sécuriser » inline (création de compte transparente).
  const [securiser, setSecuriser] = useState(false);

  const dest = useMemo<NounouDest | undefined>(
    () => doc.destinataires.find((d) => d.id === selId),
    [doc.destinataires, selId],
  );

  const url = dest ? buildEspaceUrl(dest.token) : '';

  // Portées + digest partagés (L3-1b). Chip « 📌 événement » seulement s'il existe
  // un ponctuel à venir (≤ 7 j). La portée ne change QUE le message.
  const upcoming = useMemo<Ponctuel | undefined>(() => {
    const t = todayISO();
    const max = addDaysISO(t, 7);
    return [...doc.ponctuels]
      .filter((p) => p.date >= t && p.date <= max)
      .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure))[0];
  }, [doc.ponctuels]);

  const scopes = useMemo<ScopeOption[]>(() => {
    const base: ScopeOption[] = [
      { key: 'semaine', label: 'La semaine' },
      { key: 'aujourdhui', label: "Aujourd'hui" },
      { key: 'demain', label: 'Demain' },
    ];
    if (upcoming) base.push({ key: 'evenement', label: `📌 ${cleanText(upcoming.label)}` });
    return base;
  }, [upcoming]);

  const [scope, setScope] = useState<NounouScope>('semaine');
  const [digest, setDigest] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [rappelOpen, setRappelOpen] = useState(false);
  const rappel = useStore((s) => s.app.rappels?.nounou);

  useEffect(() => {
    setQr(null);
    setLastOpen(null);
    if (dest) void lastEspaceOpen(dest.token).then(setLastOpen);
  }, [dest]);

  useEffect(() => {
    setConfirmEmpty(false);
    if (!dest) return setDigest('');
    setDigest(buildNounouDigest({ prenom: dest.prenom, scope, link: buildEspaceUrl(dest.token), doc, upcoming }));
  }, [scope, dest?.token, dest?.prenom, doc, upcoming]);

  const createDest = () => {
    const n = newName.trim();
    if (!n) return toast('Donnez un prénom');
    const id = upsertDest({ prenom: n, role: 'Nounou', langue: 'fr', enfants: [] });
    setSelId(id);
    setNewName('');
    setAdding(false);
    toast('Destinataire créé');
  };

  const setLangue = (langue: NounouLangue) => {
    if (!dest) return;
    upsertDest({ id: dest.id, prenom: dest.prenom, langue });
  };

  const toggleEnfant = (eid: string) => {
    if (!dest) return;
    const has = dest.enfants.includes(eid);
    const enfants = has ? dest.enfants.filter((x) => x !== eid) : [...dest.enfants, eid];
    upsertDest({ id: dest.id, prenom: dest.prenom, enfants });
  };

  const scopedKids =
    dest && dest.enfants.length
      ? doc.enfants.filter((e) => dest.enfants.includes(e.id))
      : doc.enfants;
  const kidsLabel = scopedKids.map((e) => e.prenom).join(' & ') || 'tous les enfants';

  // La portée ne change QUE le message ; l'envoi publie toujours la page complète.
  const isEmptyDigest = /Rien de (particulier|prévu)|Aucun événement/.test(digest);
  const hasPhone = digits(dest?.tel).length > 0;

  const send = async () => {
    if (!dest) return;
    if (!supabaseEnabled) return toast('Connexion indisponible.');
    // F4-bis fiche B (Lecture 1) : sans session → volet « Sécuriser » inline (plus
    // de renvoi vers le nuage), puis l'envoi repart tout seul. Garde LIVE (cf.
    // PartageSheet — l'état `connected` peut ne pas être encore propagé au retour).
    {
      const live = await getSupabase()?.auth.getSession();
      if (!live?.data.session) return setSecuriser(true);
    }
    if (isEmptyDigest && !confirmEmpty) return setConfirmEmpty(true); // confirmation portée vide
    setBusy(true);
    try {
      await publishNounouEspace(doc, dest);
      // Rappel de relecture (non bloquant) si du sensible n'est pas encore relu.
      const cache = doc.translations?.[dest.langue] ?? {};
      const aRelire = Object.values(cache).filter((e) => e.status === 'aValider').length;
      const noTrans = dest.langue !== 'fr' && Object.keys(cache).length === 0;
      if (hasPhone) {
        // C-1 : numéro connu → chemin court (WhatsApp pré-ciblé), web comme natif.
        window.open(`https://wa.me/${digits(dest.tel)}?text=${encodeURIComponent(digest)}`, '_blank');
      } else if (isNative) {
        // F4-bis fiche C : sans numéro, en natif → feuille de partage système
        // (le presse-papiers seul était un héritage web — rien ne « partait »).
        await shareText(digest, `Page de ${dest.prenom}`);
      } else {
        try {
          await navigator.clipboard.writeText(digest);
        } catch {
          /* quota / mode privé : on ignore */
        }
      }
      toast(
        !hasPhone
          ? isNative
            ? 'Publié ✓'
            : 'Publié ✓ — message copié (pas de numéro)'
          : noTrans
            ? 'Envoyé (en français — pense à générer la traduction)'
            : aRelire
              ? `Envoyé · ${aRelire} traduction(s) sensible(s) à relire`
              : 'Envoyé ✓',
      );
      setConfirmEmpty(false);
      void lastEspaceOpen(dest.token).then(setLastOpen);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec de la publication');
    } finally {
      setBusy(false);
    }
  };

  // A7-C4 (audit §7.8) — « Retirer » côté Nounou : jusqu'ici `removeDest` existait
  // mais AUCUN écran ne l'appelait → destinataire immortel. Symétrique de F1
  // (Cuisine) : coupe le lien SERVEUR d'abord (honnête, session exigée), puis
  // supprime la personne en local SEULEMENT si le serveur a confirmé.
  const retirer = async () => {
    if (!dest) return;
    setBusy(true);
    try {
      const { error } = await revokeEspace(dest.token);
      if (error === 'session') {
        toast(`Connectez-vous pour retirer ${dest.prenom} — son lien doit être coupé côté serveur.`);
        return;
      }
      if (error) {
        toast(`Impossible de retirer maintenant — ${dest.prenom} est conservé, réessaie.`);
        return;
      }
      const reste = doc.destinataires.filter((d) => d.id !== dest.id);
      removeDest(dest.id);
      setSelId(reste[0]?.id ?? '');
      setAdding(reste.length === 0);
      toast(`${dest.prenom} retiré ; son lien ne donne plus rien.`);
    } finally {
      setBusy(false);
    }
  };

  const showQr = async () => {
    if (qr) return setQr(null);
    if (!dest) return;
    // Publier d'abord pour que le QR pointe vers un lien actif.
    if (supabaseEnabled) {
      try {
        await publishNounouEspace(doc, dest);
        void lastEspaceOpen(dest.token).then(setLastOpen);
      } catch {
        /* on affiche quand même le QR du lien */
      }
    }
    setQr(await qrSvg(url));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié');
    } catch {
      toast(url);
    }
  };

  return (
    <>
    <Sheet title="Partager la page" sub="Lecture seule, mise à jour en place" onClose={onClose}>
      {securiser && (
        <SecuriserVolet
          onDone={() => {
            setSecuriser(false);
            void send(); // reprend l'envoi exactement où il s'était arrêté
          }}
          onCancel={() => setSecuriser(false)}
        />
      )}
      {!securiser && (
        <>
      {/* Sélecteur de destinataire */}
      {doc.destinataires.length > 0 && (
        <div className="nz-destsel">
          {doc.destinataires.map((d) => (
            <button
              key={d.id}
              className="nz-destchip"
              aria-pressed={d.id === selId}
              onClick={() => {
                setSelId(d.id);
                setAdding(false);
              }}
            >
              {d.prenom}
            </button>
          ))}
          <button className="nz-destchip add" onClick={() => setAdding(true)}>
            <IconPlusThin size={13} /> Nouveau
          </button>
        </div>
      )}

      {adding && (
        <div className="nz-card" style={{ padding: 13, marginTop: 4 }}>
          <div className="cz-blab" style={{ marginTop: 0 }}>
            Nouveau destinataire
          </div>
          <input
            className="cz-inp"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Prénom (ex. Khadija)"
          />
          <button className="cz-cta" style={{ marginTop: 12 }} onClick={createDest}>
            <IconPlusThin size={18} /> Créer
          </button>
        </div>
      )}

      {dest && (
        <>
          <div className="nz-summary">
            <div className="slab">Destinataire</div>
            <div className="sbig">{dest.prenom}</div>
            <div className="ssub">
              {dest.role} · {kidsLabel}
            </div>
          </div>

          {/* L3-1b — portées + digest WhatsApp partagés */}
          <DigestBlock
            role="nounou"
            scopes={scopes}
            active={scope}
            onScope={(k) => setScope(k as NounouScope)}
            value={digest}
            onChange={setDigest}
          />

          <button className="cz-cfgrow" onClick={() => setRappelOpen(true)}>
            <span className="e">🔔</span>
            <span className="st">
              <b>Rappel d’envoi</b>
              <i>{rappel ? rappelLabel(rappel) : 'Désactivé'}</i>
            </span>
            <span className="go">{rappel ? 'Modifier' : 'Activer'}</span>
          </button>

          {/* FN4.1 — langue par destinataire */}
          <div className="cz-blab">Langue de sa page</div>
          <div className="nz-langsel">
            {NOUNOU_LANGS.map((l) => (
              <button
                key={l.code}
                /* `rtl` reste la vérité du RENDU de la page, pas de son NOM : le
                   libellé est français, il ne prend donc pas la police arabe. */
                className="nz-langchip"
                aria-pressed={dest.langue === l.code}
                onClick={() => setLangue(l.code)}
              >
                <span className="ln">{l.nom}</span>
                <span className="ls">{l.author ? 'Auteur' : l.sub}</span>
              </button>
            ))}
          </div>
          {dest.langue !== 'fr' && (
            <>
              <div className="nz-info draft" style={{ marginTop: 10 }}>
                <span>
                  Vous écrivez en français ; la traduction part avec le lien. Pensez à <b>relire le
                  sensible</b> (santé, urgences, conduites, allergies) quand vous pouvez.
                </span>
              </div>
              <button className="cz-cta ghost" onClick={() => onTraduire(dest.langue)}>
                Préparer / relire la traduction
              </button>
            </>
          )}

          {/* Enfants scopés */}
          <div className="cz-blab" style={{ marginTop: 16 }}>
            Enfants concernés
          </div>
          <div className="nz-kidsel">
            {doc.enfants.map((e) => {
              const active = dest.enfants.length === 0 || dest.enfants.includes(e.id);
              return (
                <button
                  key={e.id}
                  className="nz-kbtn"
                  aria-pressed={active}
                  onClick={() => toggleEnfant(e.id)}
                >
                  <span className="kd" style={{ background: e.couleur }}>
                    {e.initiale}
                  </span>
                  {e.prenom}
                </button>
              );
            })}
          </div>
          {dest.enfants.length === 0 && (
            <div className="nz-emptyline" style={{ marginTop: 4 }}>
              Aucun sélectionné = tous les enfants.
            </div>
          )}

          {/* Téléphone (WhatsApp) */}
          <div className="cz-blab" style={{ marginTop: 16 }}>
            Téléphone (optionnel)
          </div>
          <input
            className="cz-inp"
            value={dest.tel ?? ''}
            onChange={(e) => upsertDest({ id: dest.id, prenom: dest.prenom, tel: e.target.value })}
            placeholder="Ex. +212 6 12 34 56 78"
            inputMode="tel"
          />

          {/* Ce qu'elle reçoit */}
          <div className="cz-blab" style={{ marginTop: 18 }}>
            Ce qu’elle reçoit
          </div>
          <div className="nz-card" style={{ padding: '0 15px' }}>
            <div className="nz-kv" style={{ borderTop: 'none' }}>
              <div className="v">📅 La journée, jour après jour (vacances comprises)</div>
            </div>
            <div className="nz-kv">
              <div className="v">
                👶 La fiche de {scopedKids.length > 1 ? 'chaque enfant' : 'l’enfant'}
              </div>
            </div>
            <div className="nz-kv">
              <div className="v" style={{ color: 'var(--muted)' }}>
                🧭 Conduites · 🚨 contacts &amp; urgences — à venir (lots 2-3)
              </div>
            </div>
          </div>

          <div className="nz-info" style={{ marginTop: 12 }}>
            <span>
              S’ouvre dans son navigateur et <b>marche hors-ligne</b> — rien à installer. Le même lien
              reste <b>à jour</b> à chaque envoi.
            </span>
          </div>

          {/* Actions */}
          <button className="cz-cta" onClick={send} disabled={busy}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.535-.927zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
            </svg>
            {busy
              ? 'Publication…'
              : confirmEmpty
                ? 'Rien de prévu — envoyer quand même'
                : hasPhone
                  ? 'Envoyer sur WhatsApp'
                  : 'Publier + copier le message'}
          </button>
          <button className="cz-cta ghost" onClick={showQr}>
            {qr ? 'Masquer le QR' : 'Afficher le QR code'}
          </button>
          {qr && (
            <div className="nz-qrcard">
              <div className="nz-qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="qc">À coller au frigo, ou à scanner avec l’appareil photo.</div>
            </div>
          )}
          <button className="cz-cta ghost" onClick={copy}>
            Copier le lien
          </button>
          <button className="cz-cta ghost danger" onClick={retirer} disabled={busy}>
            Retirer {dest.prenom}
          </button>

          <div className="nz-receipt">
            <span className="dot" />
            {lastOpen ? `Ouvert ${timeAgo(lastOpen)} · mise à jour en place` : 'Pas encore ouvert'}
          </div>
        </>
      )}
        </>
      )}
    </Sheet>
    {rappelOpen && <RappelSheet kind="nounou" onClose={() => setRappelOpen(false)} toast={toast} />}
    </>
  );
}
