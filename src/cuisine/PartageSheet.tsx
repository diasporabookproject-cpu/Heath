import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
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
import { isNative, shareText } from '../lib/platform';
import { getSupabase, supabaseEnabled } from '../lib/supabase';
import SecuriserVolet from '../components/SecuriserVolet';
import { todayKey } from './dates';
import { buildCuisineDigest, type CuisineScope } from '../maison/digest';
import { DigestBlock, type ScopeOption } from '../ui/DigestBlock';
import { qrSvg } from '../lib/qr';
import { rappelLabel } from '../lib/rappel';
import RappelSheet from './RappelSheet';
import type { Destinataire, SecuriteFiche } from '../types';
import EspaceCuisine from './EspaceCuisine';
import { IconSend, IconEye, IconLoader, IconCheck } from './icons';

// Registre neutre (lot partage T1) : le métier, jamais le genre présumé.
const ROLES = ['Cuisine', 'Ménage', 'Nounou', 'Autre'];
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
  /** F6.2 : portée initiale du digest (suit la vue / le créneau F6.1). */
  initialScope?: CuisineScope;
  initialDayKey?: string;
}

/** FC9 — Envoyer le menu : un seul geste (espace mis à jour + rappel WhatsApp). */
export default function PartageSheet({ onClose, toast, initialToken, initialScope, initialDayKey }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const persons = useStore((s) => s.settings.persons);
  const rappel = useStore((s) => s.app.rappels?.cuisine);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const [rappelOpen, setRappelOpen] = useState(false);

  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  const [dests, setDests] = useState<Destinataire[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [mode, setMode] = useState<'send' | 'list' | 'edit'>('send');
  const [editing, setEditing] = useState<Destinataire | null>(null);
  const [secFiches, setSecFiches] = useState<SecuriteFiche[]>([]);
  const [lastOpen, setLastOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Espace | null>(null);
  // T3 : brouillon du champ « Ajouter une tâche » (validé → tasks du destinataire).
  const [taskDraft, setTaskDraft] = useState('');
  // T1 (lot partage) : le QR de l'accès permanent, rendu dans l'aperçu.
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // F4-bis fiche B : volet « Sécuriser » inline (création de compte transparente).
  const [securiser, setSecuriser] = useState(false);
  // F6.2 : la portée SUIT le contexte d'ouverture (créneau F6.1 aujourd'hui ;
  // horizon T7 ensuite) — elle ne change que le MESSAGE, jamais la page.
  const [scope, setScope] = useState<CuisineScope>(initialScope ?? 'semaine');
  const [dayKey, setDayKey] = useState<string>(initialDayKey ?? todayKey());
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
      role: 'Cuisine',
      langue: 'dr',
      token: newToken(),
      createdAt: Date.now(),
    };
  }

  // La portée ne change QUE le message ; l'envoi publie toujours la page complète.
  const isEmptyDigest = /Rien de (prévu|composé)/.test(digest);
  const hasPhone = digits(selected?.tel).length > 0;

  const send = async () => {
    if (!selected) return;
    // F4-bis fiche B (Lecture 1) : sans session, l'envoi ne casse plus le geste par
    // un toast « Connecte-toi ailleurs » — la feuille bascule sur le volet
    // « Sécuriser » (e-mail + code), puis l'envoi REPART TOUT SEUL (état intact).
    // Garde LIVE (pas l'état React) : au retour du volet, la session vient d'être
    // ouverte — un état pas encore propagé ne doit pas re-déclencher le volet.
    if (supabaseEnabled) {
      const live = await getSupabase()?.auth.getSession();
      if (!live?.data.session) return setSecuriser(true);
    }
    if (isEmptyDigest && !confirmEmpty) return setConfirmEmpty(true); // confirmation portée vide
    setBusy(true);
    try {
      await publishEspace(selected, SEED_CONFIG, week, byId, persons);
      if (hasPhone) {
        // C-1 : numéro connu → chemin COURT (WhatsApp pré-ciblé), web comme natif
        // (en natif, Capacitor délègue l'URL externe au système).
        const wa = `https://wa.me/${digits(selected.tel)}?text=${encodeURIComponent(digest)}`;
        window.open(wa, '_blank');
        toast(`Envoyé à ${selected.nom} ✓`);
      } else if (isNative) {
        // F4-bis fiche C : sans numéro, en natif → FEUILLE DE PARTAGE système
        // (l'utilisateur choisit le canal). Le presse-papiers seul était un
        // héritage web : sur l'APK, rien ne « partait » nulle part.
        await shareText(digest, `Page de ${selected.nom}`);
        toast('Publié ✓');
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
      // Le QR encode le LIEN PERMANENT (le jeton) — il ne change jamais (F1).
      setQr(await qrSvg(buildEspaceUrl(selected.token)).catch(() => null));
      setPreview(await previewEspace(selected, SEED_CONFIG, week, byId, persons));
    } finally {
      setBusy(false);
    }
  };

  // T3 — suivi des tâches : réglages PAR PERSONNE, persistés au destinataire
  // (IDB) ; ils partent sur la page au prochain envoi (page vivante, comme F5.5).
  const toggleChecklist = async () => {
    if (!selected) return;
    await saveDestinataire({ ...selected, checklist: !selected.checklist });
    await refresh();
  };

  const addTask = async () => {
    if (!selected || !taskDraft.trim()) return;
    const tasks = [...(selected.tasks ?? []), { id: crypto.randomUUID().slice(0, 8), t: taskDraft.trim() }];
    await saveDestinataire({ ...selected, tasks });
    setTaskDraft('');
    await refresh();
  };

  const removeTask = async (id: string) => {
    if (!selected) return;
    await saveDestinataire({ ...selected, tasks: (selected.tasks ?? []).filter((t) => t.id !== id) });
    await refresh();
  };

  const copyLink = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(buildEspaceUrl(selected.token));
      toast('Lien copié ✓ — il ne change jamais');
    } catch {
      toast('Impossible de copier ici — passe par Envoyer');
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

  // F1 (mini-lot destinataires) : le local n'est supprimé QUE si le serveur a
  // confirmé — sinon la personne est conservée et le toast dit la vérité.
  const revoke = async (d: Destinataire) => {
    setBusy(true);
    try {
      const { error } = await revokeEspace(d.token);
      if (error === 'session') {
        toast(`Connecte-toi pour retirer ${d.nom} — son lien doit être coupé côté serveur.`);
        return;
      }
      if (error) {
        toast(`Impossible de révoquer maintenant — ${d.nom} est conservé, réessaie.`);
        return;
      }
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
            {mode === 'edit'
              ? editing && dests.some((d) => d.id === editing.id)
                ? 'Modifier la personne'
                : 'Nouvelle personne'
              : mode === 'send' && selected
                ? `Partager avec ${selected.nom}`
                : 'Partager le menu'}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer" disabled={busy}>
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {securiser ? (
            <SecuriserVolet
              onDone={() => {
                setSecuriser(false);
                void send(); // reprend l'envoi exactement où il s'était arrêté
              }}
              onCancel={() => setSecuriser(false)}
            />
          ) : mode === 'edit' && editing ? (
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
              {/* T1 (lot partage, maquette) — relief et aisance, pas contrôle :
                  la personne, puis LE MESSAGE en héros, puis l'accès permanent. */}
              <div className="ck-recip">
                <div className="ck-ava">{selected.nom.charAt(0).toUpperCase() || '?'}</div>
                <div className="ck-ri">
                  <div className="n">{selected.nom}</div>
                  <span className="ck-langpill">
                    Reçoit en{' '}
                    {selected.langue === 'dr' ? <span className="ar">الدارجة</span> : 'français'}
                  </span>
                </div>
                <button className="ck-ch" onClick={() => setMode('list')}>
                  Changer
                </button>
              </div>

              <div className="ck-msgcard">
                <div className="mtop">
                  <IconSend size={15} />
                  Message
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
                <button className="ck-wabtn" onClick={send} disabled={busy}>
                  {busy ? <IconLoader size={18} className="cz-spin" /> : <IconSend size={17} />}
                  {busy
                    ? 'Envoi…'
                    : confirmEmpty
                      ? 'Rien de prévu — envoyer quand même'
                      : hasPhone
                        ? 'Envoyer sur WhatsApp'
                        : 'Publier + copier le message'}
                </button>
              </div>

              <div className="ck-tierbreak" />

              {/* T3 — suivi des tâches (maquette) : le toggle, puis l'accordéon
                  quand c'est actif — menu du jour (préview passif, les vraies
                  cases vivent sur SA page) + tâches libres éditables. */}
              <div className="ck-optcard">
                <div className="head">
                  <span className="oi">
                    <IconCheck size={17} />
                  </span>
                  <span className="ct">
                    <b>Activer la checklist</b>
                    <i>{selected.nom} pourra confirmer que les tâches sont accomplies.</i>
                  </span>
                  <button
                    className={'ck-sw' + (selected.checklist ? ' on' : '')}
                    role="switch"
                    aria-checked={!!selected.checklist}
                    aria-label="Activer la checklist"
                    onClick={toggleChecklist}
                  />
                </div>
                {selected.checklist && (
                  <div className="ck-clacc">
                    <div className="g">
                      Le menu du jour <span className="au">à cocher</span>
                    </div>
                    {(() => {
                      const jk = scope === 'jour' ? dayKey : todayKey();
                      const day = week.days[jk];
                      const rows = (['petitdej', 'dej', 'gouter', 'diner'] as const)
                        .map((k) => {
                          const m = day?.[k];
                          const id = m?.plat ?? ('entree' in (m ?? {}) ? (m as { entree?: string | null }).entree : null);
                          const r = id ? byId.get(id) : undefined;
                          return r ? { k, nom: r.nom } : null;
                        })
                        .filter((x): x is { k: 'petitdej' | 'dej' | 'gouter' | 'diner'; nom: string } => !!x);
                      const TAG: Record<string, string> = { petitdej: 'P.déj', dej: 'Déj', gouter: 'Goût.', diner: 'Dîner' };
                      return rows.length ? (
                        rows.map((r) => (
                          <div className="crow" key={r.k}>
                            <span className="ckbx" />
                            <span className={'ctag s-' + r.k}>{TAG[r.k]}</span>
                            <span className="ct2">{r.nom}</span>
                          </div>
                        ))
                      ) : (
                        <div className="crow">
                          <span className="ct2 mut">Rien au menu de ce jour pour l’instant.</span>
                        </div>
                      );
                    })()}
                    <div className="g">Tâches en plus</div>
                    {(selected.tasks ?? []).map((task) => (
                      <div className="crow" key={task.id}>
                        <span className="ckbx" />
                        <span className="ct2">{task.t}</span>
                        <button className="cx" aria-label={`Retirer « ${task.t} »`} onClick={() => void removeTask(task.id)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="addrow">
                      <input
                        className="cz-inp"
                        placeholder="Ajouter une tâche…"
                        value={taskDraft}
                        onChange={(e) => setTaskDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void addTask();
                        }}
                      />
                      <button className="go" onClick={() => void addTask()} disabled={!taskDraft.trim()}>
                        ＋
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="ck-optcard">
                <button className="head" onClick={openPreview} disabled={busy}>
                  <span className="oi">
                    <IconEye size={17} />
                  </span>
                  <span className="ct">
                    <b>Accès permanent</b>
                    <i>Sa page, avec un QR code à coller sur le frigo — le lien ne change jamais.</i>
                  </span>
                  <span className="chev">›</span>
                </button>
                <button className="qrcopy" onClick={copyLink}>
                  Copier le lien
                </button>
              </div>

              <button className="cz-cfgrow" onClick={() => setRappelOpen(true)}>
                <span className="e">🔔</span>
                <span className="st">
                  <b>Rappel d’envoi</b>
                  <i>{rappel ? rappelLabel(rappel) : 'Désactivé'}</i>
                </span>
                <span className="go">{rappel ? 'Modifier' : 'Activer'}</span>
              </button>

              <div className="ck-receipt">
                <IconEye size={15} />
                <span>
                  <b>Dernier accès :</b> {lastOpen ? formatWhen(lastOpen) : '—'}
                </span>
              </div>
            </div>
          ) : (
            <p className="cz-emptynote">Ajoute une personne pour partager le menu.</p>
          )}
        </div>
      </div>

      {rappelOpen && <RappelSheet kind="cuisine" onClose={() => setRappelOpen(false)} toast={toast} />}

      {preview && (
        <div className="cz-preview-overlay">
          <div className="cz-preview-bar">
            <span>Aperçu — ce que voit {selected?.nom}</span>
            <button className="cz-x" onClick={() => setPreview(null)} aria-label="Fermer l’aperçu">
              ✕
            </button>
          </div>
          <div className="cz-preview-body">
            {qr && (
              <div className="ck-qrblock">
                <div className="q" dangerouslySetInnerHTML={{ __html: qr }} />
                <div className="t">
                  <b>Accès permanent</b>
                  À coller sur le frigo — le lien ne change jamais.
                </div>
              </div>
            )}
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
          <button className="cz-dchip" aria-pressed={editing.langue === 'dr'} onClick={() => setEditing({ ...editing, langue: 'dr' })}>
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
            <span className="cz-tag">{d.langue === 'dr' ? 'الدارجة' : 'FR'}</span>
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
