import { useEffect, useMemo, useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconPlusThin } from './icons';
import { qrSvg } from './qr';
import { publishNounouEspace } from './partage';
import { buildEspaceUrl, lastEspaceOpen } from '../lib/espace';
import { supabaseEnabled } from '../lib/supabase';
import { NOUNOU_LANGS, type NounouDest, type NounouLangue } from '../types';

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
  connected,
  onClose,
  onTraduire,
  toast,
  initialToken,
}: {
  connected: boolean;
  onClose: () => void;
  onTraduire: (langue: NounouLangue) => void;
  toast: (m: string) => void;
  /** Destinataire à pré-sélectionner (ouverture ciblée depuis « Envoyer » de Maison). */
  initialToken?: string;
}) {
  const doc = useNounou((s) => s.doc);
  const upsertDest = useNounou((s) => s.upsertDest);

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

  const dest = useMemo<NounouDest | undefined>(
    () => doc.destinataires.find((d) => d.id === selId),
    [doc.destinataires, selId],
  );

  const url = dest ? buildEspaceUrl(dest.token) : '';

  useEffect(() => {
    setQr(null);
    setLastOpen(null);
    if (dest) void lastEspaceOpen(dest.token).then(setLastOpen);
  }, [dest]);

  const createDest = () => {
    const n = newName.trim();
    if (!n) return toast('Donne un prénom');
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

  const send = async () => {
    if (!dest) return;
    if (!supabaseEnabled || !connected) {
      return toast('Connecte-toi (icône ☁︎) pour publier le lien');
    }
    setBusy(true);
    try {
      const { url: link } = await publishNounouEspace(doc, dest);
      const text = `Bonjour ${dest.prenom} 🌿 Voici la page de ${kidsLabel} — tout y est et elle reste à jour : ${link}`;
      const tel = (dest.tel ?? '').replace(/[^\d]/g, '');
      const wa = `https://wa.me/${tel}?text=${encodeURIComponent(text)}`;
      window.open(wa, '_blank');
      // Rappel de relecture (non bloquant) si du sensible n'est pas encore relu.
      const cache = doc.translations?.[dest.langue] ?? {};
      const aRelire = Object.values(cache).filter((e) => e.status === 'aValider').length;
      const noTrans = dest.langue !== 'fr' && Object.keys(cache).length === 0;
      toast(
        noTrans
          ? 'Envoyé (en français — pense à générer la traduction)'
          : aRelire
            ? `Envoyé · ${aRelire} traduction(s) sensible(s) à relire`
            : 'Lien publié et prêt à envoyer',
      );
      void lastEspaceOpen(dest.token).then(setLastOpen);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec de la publication');
    } finally {
      setBusy(false);
    }
  };

  const showQr = async () => {
    if (qr) return setQr(null);
    if (!dest) return;
    // Publier d'abord pour que le QR pointe vers un lien actif.
    if (supabaseEnabled && connected) {
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
    <Sheet title="Partager la page" sub="Lecture seule, mise à jour en place" onClose={onClose}>
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

          {/* FN4.1 — langue par destinataire */}
          <div className="cz-blab">Langue de sa page</div>
          <div className="nz-langsel">
            {NOUNOU_LANGS.map((l) => (
              <button
                key={l.code}
                className={'nz-langchip' + (l.rtl ? ' ar' : '')}
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
                  Tu écris en français ; la traduction part avec le lien. Pense à <b>relire le
                  sensible</b> (santé, urgences, conduites, allergies) quand tu peux.
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
            {busy ? 'Publication…' : 'Envoyer sur WhatsApp'}
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

          <div className="nz-receipt">
            <span className="dot" />
            {lastOpen ? `Ouvert ${timeAgo(lastOpen)} · mise à jour en place` : 'Pas encore ouvert'}
          </div>
        </>
      )}
    </Sheet>
  );
}
