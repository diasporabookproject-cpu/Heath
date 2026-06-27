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
import { scaledRows } from '../lib/ingredients';
import { DAY_AR } from '../lib/cuisineLabels';
import type { Destinataire, SecuriteFiche } from '../types';
import EspaceCuisine from './EspaceCuisine';
import { IconSend, IconEye, IconLoader, IconCheck } from './icons';

const ROLES = ['Cuisinière', 'Femme de ménage', 'Nounou', 'Autre'];
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');

interface Props {
  onClose: () => void;
  toast: (m: string) => void;
}

/** FC9 — Envoyer le menu : un seul geste (espace mis à jour + rappel WhatsApp). */
export default function PartageSheet({ onClose, toast }: Props) {
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

  const refresh = () =>
    loadDestinataires().then((list) => {
      setDests(list);
      setSelId((cur) => cur ?? list.find((d) => d.role === 'Cuisinière')?.id ?? list[0]?.id ?? null);
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

  // Compte des jours composés (pour la phrase de résumé).
  const dayCount = SEED_CONFIG.jours.filter((j) => {
    const d = week.days[j.key];
    return !!d && (d.petitdej.plat || d.dej.plat || d.diner.plat);
  }).length;

  const waText = (d: Destinataire, url: string) =>
    d.langue === 'ar'
      ? `السلام ${d.nom}، هاهو منيو هاد الأسبوع 👉 ${url}`
      : `Bonjour ${d.nom}, voici le menu de la semaine 👉 ${url}`;

  const send = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await publishEspace(selected, SEED_CONFIG, week, byId, persons);
      const url = buildEspaceUrl(selected.token);
      const wa = `https://wa.me/${digits(selected.tel)}?text=${encodeURIComponent(waText(selected, url))}`;
      window.open(wa, '_blank');
      toast(`Menu envoyé à ${selected.nom} + rappel WhatsApp`);
      void lastEspaceOpen(selected.token).then(setLastOpen);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    if (!selected) return;
    const k = todayKey();
    const j = SEED_CONFIG.jours.find((x) => x.key === k) ?? SEED_CONFIG.jours[0];
    const d = week.days[j.key];
    const ar = selected.langue === 'ar';
    const lines: string[] = [ar ? `منيو ${DAY_AR[j.key] ?? j.nom}` : `Menu ${j.nom}`];
    const add = (label: string, id: string | null | undefined) => {
      if (!id) return;
      const r = byId.get(id);
      if (!r) return;
      const nom = ar ? r.nom_ar || r.nom : r.nom;
      const ing = scaledRows(ar ? r.ingredients_ar || r.ingredients : r.ingredients, persons)
        .map((x) => (x.qty ? `${x.name} ${x.qty}` : x.name))
        .join(' · ');
      lines.push(`\n${label} : ${nom}\n${ing}`);
    };
    if (d) {
      add(ar ? 'الفطور' : 'Petit-déj', d.petitdej.plat);
      add(ar ? 'الغدا' : 'Déjeuner', d.dej.plat);
      if (d.dej.entree) add(ar ? 'مقبلات' : 'Entrée', d.dej.entree);
      add(ar ? 'العشا' : 'Dîner', d.diner.plat);
      if (d.diner.entree) add(ar ? 'مقبلات' : 'Entrée', d.diner.entree);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('Menu du jour copié');
    } catch {
      toast('Copie impossible');
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
              <h1>Envoyer le menu de la semaine</h1>

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

              <div className="ck-summary">
                <div className="big">
                  {selected.nom} recevra le <b>menu de {dayCount} jour{dayCount > 1 ? 's' : ''}</b> avec,
                  pour chaque plat, les ingrédients (<b>pour {persons} pers.</b>), les étapes et{' '}
                  <b>tes notes vocales</b> — en{' '}
                  <b>{selected.langue === 'ar' ? 'الدارجة' : 'français'}</b>.
                </div>
                <div className="how">
                  <IconSend size={16} />
                  <span>À l’envoi, son espace se met à jour et elle reçoit un rappel WhatsApp.</span>
                </div>
                <button className="ck-prev" onClick={openPreview} disabled={busy}>
                  <IconEye size={16} />
                  Voir l’aperçu
                </button>
              </div>

              <div className="ck-receipt">
                <IconEye size={15} />
                <span>
                  <b>Dernier accès :</b> {lastOpen ? formatWhen(lastOpen) : '—'}
                </span>
              </div>

              <button className="cz-cta" onClick={send} disabled={busy}>
                {busy ? <IconLoader size={18} className="cz-spin" /> : <IconSend size={18} />}
                {busy ? 'Envoi…' : `Envoyer à ${selected.nom}`}
              </button>
              <button className="ck-copyl" onClick={copyText} disabled={busy}>
                Ou copier le menu du jour en texte
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
