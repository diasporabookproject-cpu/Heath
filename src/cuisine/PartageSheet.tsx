import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import {
  deleteDestinataire,
  loadDestinataires,
  loadSecurite,
  saveDestinataire,
} from '../lib/db';
import {
  buildEspaceUrl,
  newToken,
  publishEspace,
  previewEspace,
  revokeEspace,
  lastEspaceOpen,
  type Espace,
} from '../lib/espace';
import { todayKey } from './dates';
import { buildCuisineDigest, type CuisineScope } from '../maison/digest';
import { DigestBlock, type ScopeOption } from '../ui/DigestBlock';
import type { Destinataire, SecuriteFiche } from '../types';
import EspaceCuisine from './EspaceCuisine';
import { IconSend, IconEye, IconLoader, IconCheck } from './icons';

const ROLES = ['Cuisinière', 'Femme de ménage', 'Nounou', 'Autre'];
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
const CUISINE_SCOPES: ScopeOption[] = [
  { key: 'semaine', label: 'La semaine' },
  { key: 'aujourdhui', label: "Aujourd'hui" },
  { key: 'demain', label: 'Demain' },
  { key: 'jour', label: 'Un jour…' },
];

interface Props {
  onClose: () => void;
  toast: (m: string) => void;
  /** Destinataire à pré-sélectionner (ouverture ciblée depuis « Envoyer » de Maison). */
  initialToken?: string;
}

/** FC9 — Envoyer le menu : un seul geste (espace mis à jour + rappel WhatsApp). */
export default function PartageSheet({ onClose, toast, initialToken }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const persons = useStore((s) => s.settings.persons);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const [shown, setShown] = useState(false);
  const [dests, setDests] = useState<Destinataire[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [mode, setMode] = useState<'send' | 'list' | 'edit'>('send');
  const [editing, setEditing] = useState<Destinataire | null>(null);
  const [secFiches, setSecFiches] = useState<SecuriteFiche[]>([]);
  const [lastOpen, setLastOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Espace | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<CuisineScope>('semaine');
  const [dayKey, setDayKey] = useState<string>(todayKey());
  const [digest, setDigest] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const refresh = () =>
    loadDestinataires().then((list) => {
      setDests(list);
      setSelId(
        (cur) =>
          cur ??
          (initialToken ? list.find((d) => d.token === initialToken)?.id : undefined) ??
          list.find((d) => d.role === 'Cuisinière')?.id ??
          list[0]?.id ??
          null,
      );
      if (list.length === 0) {
        setMode('edit');
        setEditing(blank());
      }
    });

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    void refresh();
    void loadSecurite().then((all) => setSecFiches(all.filter((f) => f.statut === 'Validé')));
    return () => cancelAnimationFrame(t);
  }, []);

  const selected = dests.find((d) => d.id === selId) ?? null;

  useEffect(() => {
    setLastOpen(null);
    if (selected) void lastEspaceOpen(selected.token).then(setLastOpen);
  }, [selId, selected?.token]);

  // Digest recomposé à chaque changement de portée / jour / destinataire / menu.
  // (L'édition manuelle prime ensuite : elle écrit directement `digest`.)
  useEffect(() => {
    setConfirmEmpty(false);
    if (!selected) return setDigest('');
    setDigest(
      buildCuisineDigest({
        prenom: selected.nom,
        scope,
        dayKey,
        link: buildEspaceUrl(selected.token),
        week,
        byId,
      }),
    );
  }, [scope, dayKey, selected?.token, selected?.nom, week, byId]);

  function blank(): Destinataire {
    return {
      id: crypto.randomUUID(),
      nom: '',
      role: 'Cuisinière',
      langue: 'ar',
      token: newToken(),
      createdAt: Date.now(),
    };
  }

  // La portée ne change QUE le message ; l'envoi publie toujours la page complète.
  const isEmptyDigest = /Rien de (prévu|composé)/.test(digest);
  const hasPhone = digits(selected?.tel).length > 0;

  const send = async () => {
    if (!selected) return;
    if (isEmptyDigest && !confirmEmpty) return setConfirmEmpty(true); // confirmation portée vide
    setBusy(true);
    try {
      await publishEspace(selected, SEED_CONFIG, week, byId, persons);
      if (hasPhone) {
        const wa = `https://wa.me/${digits(selected.tel)}?text=${encodeURIComponent(digest)}`;
        window.open(wa, '_blank');
        toast(`Envoyé à ${selected.nom} ✓`);
      } else {
        try {
          await navigator.clipboard.writeText(digest);
        } catch {
          /* quota / mode privé : on ignore */
        }
        toast('Publié ✓ — message copié (pas de numéro)');
      }
      setConfirmEmpty(false);
      void lastEspaceOpen(selected.token).then(setLastOpen);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      setPreview(await previewEspace(selected, SEED_CONFIG, week, byId, persons));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.nom.trim()) return;
    await saveDestinataire({ ...editing, nom: editing.nom.trim() });
    setSelId(editing.id);
    setEditing(null);
    setMode('send');
    await refresh();
  };

  const revoke = async (d: Destinataire) => {
    setBusy(true);
    try {
      await revokeEspace(d.token);
      await deleteDestinataire(d.id);
      setSelId(null);
      await refresh();
      toast(`${d.nom} retiré ; son lien ne donne plus rien.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={busy ? undefined : onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {mode === 'edit' ? (editing && dests.some((d) => d.id === editing.id) ? 'Modifier la personne' : 'Nouvelle personne') : 'Partager le menu'}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer" disabled={busy}>
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {mode === 'edit' && editing ? (
            <EditForm
              editing={editing}
              setEditing={setEditing}
              secFiches={secFiches}
              onSave={saveEdit}
              onCancel={() => {
                setEditing(null);
                setMode(dests.length ? 'send' : 'list');
              }}
            />
          ) : mode === 'list' ? (
            <ListView
              dests={dests}
              selId={selId}
              onPick={(id) => {
                setSelId(id);
                setMode('send');
              }}
              onAdd={() => {
                setEditing(blank());
                setMode('edit');
              }}
              onEdit={(d) => {
                setEditing(d);
                setMode('edit');
              }}
              onRevoke={revoke}
              busy={busy}
            />
          ) : selected ? (
            <div className="ck-send">
              <h1 style={{ marginBottom: 2 }}>Envoyer à {selected.nom}</h1>
              <div className="mz-sm" style={{ marginBottom: 10 }}>
                L’essentiel dans WhatsApp — et toute sa page à jour, en un lien.
              </div>

              <div className="ck-recip">
                <div className="ck-ava">{selected.nom.charAt(0).toUpperCase() || '?'}</div>
                <div className="ck-ri">
                  <div className="n">{selected.nom}</div>
                  <div className="r">
                    {selected.role} ·{' '}
                    <span className="lang">{selected.langue === 'ar' ? 'الدارجة' : 'Français'}</span>
                  </div>
                </div>
                <button className="ck-ch" onClick={() => setMode('list')}>
                  Changer
                </button>
              </div>

              <DigestBlock
                role="cuisine"
                scopes={CUISINE_SCOPES}
                active={scope}
                onScope={(k) => setScope(k as CuisineScope)}
                value={digest}
                onChange={setDigest}
              />
              {scope === 'jour' && (
                <div className="mz-digest grn">
                  <div className="mz-scope" style={{ marginTop: 8 }}>
                    {SEED_CONFIG.jours.map((j) => (
                      <button
                        key={j.key}
                        className={'mz-sc' + (dayKey === j.key ? ' on' : '')}
                        onClick={() => setDayKey(j.key)}
                      >
                        {j.nom.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className="ck-prev" onClick={openPreview} disabled={busy} style={{ marginTop: 12 }}>
                <IconEye size={16} />
                Aperçu · QR
              </button>

              <div className="ck-receipt">
                <IconEye size={15} />
                <span>
                  <b>Dernier accès :</b> {lastOpen ? formatWhen(lastOpen) : '—'}
                </span>
              </div>

              <button className="cz-cta" onClick={send} disabled={busy}>
                {busy ? <IconLoader size={18} className="cz-spin" /> : <IconSend size={18} />}
                {busy
                  ? 'Envoi…'
                  : confirmEmpty
                    ? 'Rien de prévu — envoyer quand même'
                    : hasPhone
                      ? `Envoyer à ${selected.nom}`
                      : 'Publier + copier le message'}
              </button>
            </div>
          ) : (
            <p className="cz-emptynote">Ajoute une personne pour partager le menu.</p>
          )}
        </div>
      </div>

      {preview && (
        <div className="cz-preview-overlay">
          <div className="cz-preview-bar">
            <span>Aperçu — ce que voit {selected?.nom}</span>
            <button className="cz-x" onClick={() => setPreview(null)} aria-label="Fermer l’aperçu">
              ✕
            </button>
          </div>
          <div className="cz-preview-body">
            <EspaceCuisine espace={preview} />
          </div>
        </div>
      )}
    </>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const hh = `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
    if (sameDay) return `aujourd’hui, ${hh}`;
    return `${d.getDate()}/${d.getMonth() + 1}, ${hh}`;
  } catch {
    return '—';
  }
}

function EditForm({
  editing,
  setEditing,
  secFiches,
  onSave,
  onCancel,
}: {
  editing: Destinataire;
  setEditing: (d: Destinataire) => void;
  secFiches: SecuriteFiche[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const toggleSec = (id: string) => {
    const cur = new Set(editing.securiteIds ?? []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    setEditing({ ...editing, securiteIds: [...cur] });
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Nom</div>
        <input className="cz-inp" value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} autoFocus />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Rôle</div>
        <div className="cz-dietchips">
          {ROLES.map((r) => (
            <button key={r} className="cz-dchip" aria-pressed={editing.role === r} onClick={() => setEditing({ ...editing, role: r })}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="cz-block">
        <div className="cz-blab">Langue de lecture</div>
        <div className="cz-dietchips">
          <button className="cz-dchip" aria-pressed={editing.langue === 'fr'} onClick={() => setEditing({ ...editing, langue: 'fr' })}>
            Français
          </button>
          <button className="cz-dchip" aria-pressed={editing.langue === 'ar'} onClick={() => setEditing({ ...editing, langue: 'ar' })}>
            الدارجة
          </button>
        </div>
      </div>
      <div className="cz-block">
        <div className="cz-blab">Téléphone WhatsApp (optionnel)</div>
        <input
          className="cz-inp"
          inputMode="tel"
          placeholder="2126 12 34 56 78"
          value={editing.tel ?? ''}
          onChange={(e) => setEditing({ ...editing, tel: e.target.value })}
        />
      </div>
      {secFiches.length > 0 && (
        <div className="cz-block">
          <div className="cz-blab">Fiches Sécurité assignées</div>
          <div className="cz-dietchips">
            {secFiches.map((f) => (
              <button
                key={f.id}
                className="cz-dchip"
                aria-pressed={(editing.securiteIds ?? []).includes(f.id)}
                onClick={() => toggleSec(f.id)}
              >
                {f.titre}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="cz-cta" onClick={onSave} disabled={!editing.nom.trim()}>
        <IconCheck size={17} />
        Enregistrer
      </button>
      <button className="cz-cta ghost" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

function ListView({
  dests,
  selId,
  onPick,
  onAdd,
  onEdit,
  onRevoke,
  busy,
}: {
  dests: Destinataire[];
  selId: string | null;
  onPick: (id: string) => void;
  onAdd: () => void;
  onEdit: (d: Destinataire) => void;
  onRevoke: (d: Destinataire) => void;
  busy: boolean;
}) {
  return (
    <div>
      <button className="cz-cta" onClick={onAdd} style={{ marginTop: 6 }}>
        + Ajouter une personne
      </button>
      {dests.length === 0 && <p className="cz-emptynote">Aucune personne enregistrée.</p>}
      {dests.map((d) => (
        <div key={d.id} className={'cz-librow' + (d.id === selId ? '' : '')} style={{ marginTop: 10, cursor: 'default' }}>
          <div className="cz-libtop">
            <span className="nm" style={{ fontWeight: 600, flex: 1 }} onClick={() => onPick(d.id)}>
              {d.nom}
            </span>
            <span className="cz-tag">{d.role}</span>
            <span className="cz-tag">{d.langue === 'ar' ? 'الدارجة' : 'FR'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="cz-dchip" onClick={() => onPick(d.id)}>
              Choisir
            </button>
            <button className="cz-dchip" onClick={() => onEdit(d)}>
              Modifier
            </button>
            <button className="cz-dchip" onClick={() => onRevoke(d)} disabled={busy}>
              Révoquer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
