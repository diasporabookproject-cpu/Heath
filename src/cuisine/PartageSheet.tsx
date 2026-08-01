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
import { readChecks, countDone } from '../lib/espace-checks';
import { isNative, shareText } from '../lib/platform';
import { getSupabase, supabaseEnabled } from '../lib/supabase';
import SecuriserVolet from '../components/SecuriserVolet';
import { todayKey } from './dates';
import { buildCuisineGreeting, corpsSansLien } from '../maison/digest';
import type { Destinataire, SecuriteFiche } from '../types';
import EspaceCuisine from './EspaceCuisine';
import { IconLoader, IconCheck, IconCopy, IconLien, IconOeil } from './icons';

// Registre neutre (lot partage T1) : le métier, jamais le genre présumé.
const ROLES = ['Cuisine', 'Ménage', 'Nounou', 'Autre'];
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');

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
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  const [dests, setDests] = useState<Destinataire[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [mode, setMode] = useState<'send' | 'list' | 'edit'>('send');
  const [editing, setEditing] = useState<Destinataire | null>(null);
  const [secFiches, setSecFiches] = useState<SecuriteFiche[]>([]);
  const [preview, setPreview] = useState<Espace | null>(null);
  // T3 : brouillon du champ « Ajouter une tâche » (validé → tasks du destinataire).
  const [taskDraft, setTaskDraft] = useState('');
  // T1 (lot partage) : le QR de l'accès permanent, rendu dans l'aperçu.
  // T4 : résumé de l'état côté employeur (coches faites + dernier accès), dans l'aperçu.
  const [previewDone, setPreviewDone] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // F4-bis fiche B : volet « Sécuriser » inline (création de compte transparente).
  const [securiser, setSecuriser] = useState(false);
  // T1 (maquette) : le message est un mot court ; sa LANGUE se choisit (toggle),
  // défaut = la langue de lecture de la personne. Le détail vit sur la page.
  const [msgLang, setMsgLang] = useState<'fr' | 'dr'>('fr');
  const [digest, setDigest] = useState('');

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

  // Message recomposé quand la personne ou la langue du message change. Depuis la
  // décision ③ il n'est plus éditable : `digest` n'a qu'une source, ce constructeur.
  useEffect(() => {
    if (!selected) return setDigest('');
    setMsgLang(selected.langue === 'dr' ? 'dr' : 'fr');
  }, [selected?.token, selected?.langue]);
  useEffect(() => {
    if (!selected) return;
    setDigest(buildCuisineGreeting({ prenom: selected.nom, link: buildEspaceUrl(selected.token), lang: msgLang }));
  }, [selected?.token, selected?.nom, msgLang]);

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

  const hasPhone = digits(selected?.tel).length > 0;
  // Affichage de la bulle : le message envoyé, moins le lien (retiré par sa valeur
  // exacte — aucune heuristique, donc aucun risque de couper autre chose).
  const corpsMessage = selected ? corpsSansLien(digest, buildEspaceUrl(selected.token)) : '';

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
        // 🔴 Sans numéro, le web COPIAIT en silence — et le bouton dit maintenant
        // « Partager sur WhatsApp ». Un libellé doit être vrai : on ouvre donc
        // WhatsApp SANS destinataire (`wa.me/?text=`), qui propose de choisir le
        // contact, avec le message déjà écrit. Le presse-papiers reste le filet.
        try {
          await navigator.clipboard.writeText(digest);
        } catch {
          /* quota / mode privé : on ignore */
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(digest)}`, '_blank');
        toast('Publié ✓ — choisissez le contact dans WhatsApp');
      }
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
      setPreview(await previewEspace(selected, SEED_CONFIG, week, byId, persons));
      // T4 : l'état RÉEL — chargé APRÈS l'ouverture, jamais bloquant (le réseau
      // ne doit pas retarder l'aperçu ; le résumé se remplit quand il résout).
      setPreviewDone(null);
      setPreviewOpen(null);
      if (selected.checklist) {
        const tok = selected.token;
        void readChecks(tok).then((evs) => setPreviewDone(evs ? countDone(evs) : null));
        void lastEspaceOpen(tok).then(setPreviewOpen);
      }
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
        toast(`Connectez-vous pour retirer ${d.nom} — son lien doit être coupé côté serveur.`);
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
      {/* `ck-sheet` : la maquette du partage a sa propre coquille (titre 18/800, croix
          sobre, corps à 20px). On la porte ICI seulement — restyler `.cz-sheethead`
          globalement toucherait toutes les feuilles du produit, Nounou compris. */}
      <div className={'cz-sheet ck-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
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
                  {/* Décision PO ① : le nom de langue s'écrit en FRANÇAIS. Ce libellé
                      sert à CHOISIR la langue de son destinataire — quelqu'un qui ne lit
                      pas l'arabe doit pouvoir le faire. L'écriture arabe reste au CONTENU
                      (la bulle, la page reçue), jamais au chrome. */}
                  <span className="ck-langpill">
                    Reçoit en <b>{selected.langue === 'dr' ? 'darija' : 'français'}</b>
                  </span>
                </div>
                <button className="ck-ch" onClick={() => setMode('list')}>
                  Changer
                </button>
              </div>

              {/* Maquette (partie A) : « Message » = un mot COURT préretempli, avec
                  le toggle de langue ; le détail vit sur la page (« il est ici 👇 »). */}
              <div className="ck-msgcard">
                <div className="mtop">
                  <span className="mlab">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Message
                  </span>
                  <span className="ck-langtog">
                    <button className={msgLang === 'fr' ? 'on' : ''} onClick={() => setMsgLang('fr')}>
                      Français
                    </button>
                    <button className={msgLang === 'dr' ? 'on' : ''} onClick={() => setMsgLang('dr')}>
                      Darija
                    </button>
                  </span>
                </div>
                {/* Décision PO ③ : la bulle est FIGÉE. Le message n'est plus un digest
                    de plats mais un bonjour de deux lignes — il n'y a plus rien à éditer
                    (renversement assumé de « bulle éditable », L3-1b / DEVLOG:385).
                    🔴 Le lien est remplacé À L'ÉCRAN par une puce, mais le texte
                    RÉELLEMENT ENVOYÉ (`digest`) garde l'URL en clair : WhatsApp en a
                    besoin, et les deux dérivent de la même chaîne — ils ne peuvent pas
                    diverger. */}
                <div className={'ck-bubble' + (msgLang === 'dr' ? ' ar' : '')}>
                  <p className="txt">{corpsMessage}</p>
                  <span className="ck-lkchip">
                    <IconLien size={12} />
                    {msgLang === 'dr' ? 'الصفحة ديالها' : 'Sa page'}
                  </span>
                </div>
                <button className="ck-wabtn" onClick={send} disabled={busy}>
                  {busy ? (
                    <IconLoader size={18} className="cz-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19">
                      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0 1 12 4z" />
                    </svg>
                  )}
                  {busy ? 'Envoi…' : 'Partager sur WhatsApp'}
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
                      const jk = todayKey(); // le menu cochable = celui d'aujourd'hui
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

              {/* Décision PO ② : la CARTE « Accès permanent » disparaît — mais rien
                  de ce qu'elle ouvrait ne meurt. Elle était la SEULE porte vers trois
                  choses : le QR (qui déménage en T2), l'aperçu de la page, et le retour
                  des coches (« 3 cochés · vu 14h32 », la moitié B du lot Partage).
                  Deux liens discrets la remplacent, comme la maquette. */}
              <div className="ck-footlinks">
                <button className="ck-flink" onClick={openPreview} disabled={busy}>
                  <IconOeil size={14} />
                  Aperçu de sa page
                </button>
                <button className="ck-flink" onClick={copyLink}>
                  <IconCopy size={14} />
                  Copier le lien
                </button>
              </div>

            </div>
          ) : (
            <p className="cz-emptynote">Ajoutez une personne pour partager le menu.</p>
          )}
        </div>
      </div>

      {preview && (
        <div className="cz-preview-overlay">
          <div className="cz-preview-bar">
            <span>
              Aperçu — ce que voit {selected?.nom}
              {previewDone !== null && (
                <small className="ck-vustate">
                  {previewDone > 0 ? `${previewDone} coché${previewDone > 1 ? 's' : ''}` : 'Rien de coché encore'}
                  {previewOpen ? ` · vu ${formatWhen(previewOpen)}` : ''}
                </small>
              )}
            </span>
            <button className="cz-x" onClick={() => setPreview(null)} aria-label="Fermer l’aperçu">
              ✕
            </button>
          </div>
          <div className="cz-preview-body">
            <EspaceCuisine espace={preview} viewChecksToken={selected?.token} />
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
            Darija
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
            <span className="cz-tag">{d.langue === 'dr' ? 'Darija' : 'Français'}</span>
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
