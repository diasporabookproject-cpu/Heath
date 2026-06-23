import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { deleteDestinataire, loadDestinataires, loadSecurite, saveDestinataire } from '../lib/db';
import { buildEspaceUrl, newToken, publishEspace, revokeEspace } from '../lib/espace';
import type { Destinataire, SecuriteFiche } from '../types';

const ROLES = ['Cuisinière', 'Femme de ménage', 'Nounou', 'Autre'];

export default function DestinatairesSheet({ onClose }: { onClose: () => void }) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const [list, setList] = useState<Destinataire[]>([]);
  const [secFiches, setSecFiches] = useState<SecuriteFiche[]>([]);
  const [editing, setEditing] = useState<Destinataire | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => loadDestinataires().then(setList);
  useEffect(() => {
    refresh();
    loadSecurite().then((all) => setSecFiches(all.filter((f) => f.statut === 'Validé')));
  }, []);

  const toggleSecurite = (id: string) => {
    if (!editing) return;
    const cur = new Set(editing.securiteIds ?? []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    setEditing({ ...editing, securiteIds: [...cur] });
  };

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((c) => (c === m ? null : c)), 3000);
  };

  const startAdd = () =>
    setEditing({
      id: crypto.randomUUID(),
      nom: '',
      role: 'Cuisinière',
      langue: 'ar',
      token: newToken(),
      createdAt: Date.now(),
    });

  const save = async () => {
    if (!editing || !editing.nom.trim()) return;
    await saveDestinataire({ ...editing, nom: editing.nom.trim() });
    setEditing(null);
    refresh();
  };

  const publish = async (d: Destinataire) => {
    setBusy(d.id);
    try {
      const { url, audioCount } = await publishEspace(d, SEED_CONFIG, week, byId);
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: `Espace de ${d.nom}`, text: `Espace de ${d.nom} 👇`, url });
      } else {
        await navigator.clipboard.writeText(url);
        flash(`Lien copié (${audioCount} note(s) vocale(s)).`);
      }
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (d: Destinataire) => {
    await navigator.clipboard.writeText(buildEspaceUrl(d.token));
    flash('Lien permanent copié.');
  };

  const revoke = async (d: Destinataire) => {
    setBusy(d.id);
    try {
      await revokeEspace(d.token);
      await deleteDestinataire(d.id);
      refresh();
      flash(`${d.nom} retiré ; son lien ne donne plus rien.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>Partager à une personne</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        <div className="sheet__list">
          {editing ? (
            <>
              <div className="field">
                <label>Nom</label>
                <input
                  value={editing.nom}
                  onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Rôle</label>
                  <select
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Langue de lecture</label>
                  <select
                    value={editing.langue}
                    onChange={(e) =>
                      setEditing({ ...editing, langue: e.target.value as Destinataire['langue'] })
                    }
                  >
                    <option value="fr">Français</option>
                    <option value="ar">الدارجة</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Fiches Sécurité assignées à cette personne</label>
                {secFiches.length === 0 ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Aucune fiche Sécurité validée. Crée-les dans l'onglet « Sécurité », puis
                    valide-les pour pouvoir les assigner ici.
                  </p>
                ) : (
                  secFiches.map((f) => (
                    <label key={f.id} className="course-item">
                      <input
                        type="checkbox"
                        checked={(editing.securiteIds ?? []).includes(f.id)}
                        onChange={() => toggleSecurite(f.id)}
                      />
                      <span className="course-item__name">{f.titre}</span>
                    </label>
                  ))
                )}
              </div>
              <button className="btn" onClick={save} disabled={!editing.nom.trim()}>
                Enregistrer
              </button>
              <button className="btn btn--ghost" onClick={() => setEditing(null)}>
                Annuler
              </button>
            </>
          ) : (
            <>
              <p className="hint">
                Crée une personne (cuisinière, nounou…) avec sa langue. « Partager » publie le menu
                courant dans son espace permanent (lien à lui envoyer une fois ; il se met à jour en
                place ensuite).
              </p>
              <button className="btn" onClick={startAdd}>
                + Ajouter une personne
              </button>
              {msg && <div className="import-report">{msg}</div>}
              {list.length === 0 && <p className="empty-note">Aucune personne enregistrée.</p>}
              {list.map((d) => (
                <div className="card" key={d.id} style={{ marginTop: 10 }}>
                  <div className="lib-item__name">
                    {d.nom}{' '}
                    <span className="daycard__type">
                      · {d.role} · {d.langue === 'ar' ? 'الدارجة' : 'Français'}
                    </span>
                  </div>
                  <button
                    className="btn"
                    style={{ marginTop: 8 }}
                    onClick={() => publish(d)}
                    disabled={busy === d.id}
                  >
                    {busy === d.id ? 'Publication…' : '🔗 Partager le menu courant'}
                  </button>
                  <div className="field-row" style={{ marginTop: 8 }}>
                    <button className="btn btn--ghost" onClick={() => copyLink(d)}>
                      Copier le lien
                    </button>
                    <button className="btn btn--ghost" onClick={() => setEditing(d)}>
                      Modifier
                    </button>
                  </div>
                  <button
                    className="lib-toggle"
                    style={{ marginTop: 8 }}
                    onClick={() => revoke(d)}
                    disabled={busy === d.id}
                  >
                    Révoquer (supprime l'accès)
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
