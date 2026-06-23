import { useEffect, useMemo, useState } from 'react';
import { deleteSecurite, loadSecurite, saveSecurite } from '../lib/db';
import seedData from '../data/securite-seed.json';
import VoiceNote from '../components/VoiceNote';
import type { SecuriteFiche, SecuriteType } from '../types';

const TYPES: { id: SecuriteType; label: string }[] = [
  { id: 'numeros', label: "Numéros d'urgence" },
  { id: 'procedure', label: 'Procédures' },
  { id: 'gestes', label: 'Gestes permis / interdits' },
];
const TYPE_LABEL: Record<SecuriteType, string> = {
  numeros: "Numéros d'urgence",
  procedure: 'Procédure',
  gestes: 'Gestes permis / interdits',
};

export default function SecuriteView() {
  const [list, setList] = useState<SecuriteFiche[]>([]);
  const [editing, setEditing] = useState<SecuriteFiche | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => loadSecurite().then(setList);
  useEffect(() => {
    refresh();
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((c) => (c === m ? null : c)), 3000);
  };

  const importSeed = async () => {
    const existing = new Set(list.map((f) => f.titre));
    let n = 0;
    for (const s of seedData as Omit<SecuriteFiche, 'id' | 'statut' | 'createdAt'>[]) {
      if (existing.has(s.titre)) continue;
      await saveSecurite({
        ...s,
        id: crypto.randomUUID(),
        statut: 'Test',
        createdAt: Date.now() + n,
      });
      n++;
    }
    await refresh();
    flash(n ? `${n} fiche(s) importée(s) en statut Test — à relire et valider.` : 'Déjà importé.');
  };

  const startAdd = (type: SecuriteType) =>
    setEditing({
      id: crypto.randomUUID(),
      type,
      titre: '',
      titre_ar: '',
      contenu: '',
      contenu_ar: '',
      statut: 'Test',
      createdAt: Date.now(),
    });

  const grouped = useMemo(
    () =>
      TYPES.map((t) => ({
        ...t,
        items: list
          .filter((f) => f.type === t.id)
          .sort((a, b) => {
            const order = (s: SecuriteFiche['statut']) =>
              s === 'Validé' ? 0 : s === 'Test' ? 1 : 2;
            return order(a.statut) - order(b.statut) || a.createdAt - b.createdAt;
          }),
      })),
    [list],
  );

  return (
    <div>
      <p className="hint">
        Référentiel des consignes de sécurité du foyer. Le contenu est saisi par les parents
        (aucune génération par IA). Seules les fiches <b>Validé</b> apparaissent dans l'espace du
        personnel à qui elles sont assignées.
      </p>

      <button className="btn btn--ghost" onClick={importSeed}>
        ⇪ Importer le pack de démarrage
      </button>
      {msg && <div className="import-report">{msg}</div>}

      {grouped.map((g) => (
        <div key={g.id}>
          <div className="lib-section__title">{g.label}</div>
          <div className="card">
            {g.items.length === 0 && <p className="empty-note">Aucune fiche.</p>}
            {g.items.map((f) => (
              <div
                key={f.id}
                className={'lib-item' + (f.statut === 'Écarté' ? ' lib-item--ecarte' : '')}
              >
                <button className="lib-item__main lib-item__edit" onClick={() => setEditing(f)}>
                  <div className="lib-item__name">{f.titre || '(sans titre)'}</div>
                  <div className="lib-item__sub">
                    {f.statut}
                    {f.titre_ar ? ' · الدارجة ✓' : ' · darija manquante'}
                  </div>
                </button>
                {f.statut !== 'Validé' ? (
                  <button
                    className="lib-toggle"
                    onClick={() => saveSecurite({ ...f, statut: 'Validé' }).then(refresh)}
                  >
                    Valider
                  </button>
                ) : (
                  <button
                    className="lib-toggle"
                    onClick={() => saveSecurite({ ...f, statut: 'Test' }).then(refresh)}
                  >
                    Repasser en Test
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn--small btn--ghost" onClick={() => startAdd(g.id)}>
            + Ajouter ({g.label})
          </button>
        </div>
      ))}

      {editing && (
        <SecuriteEditor
          fiche={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SecuriteEditor({
  fiche,
  onClose,
  onSaved,
}: {
  fiche: SecuriteFiche;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<SecuriteFiche>(fiche);
  const placeholder =
    f.type === 'numeros'
      ? 'Une ligne par contact : « Pédiatre : 06 12 … »'
      : f.type === 'procedure'
        ? 'Une étape par ligne.'
        : 'Un geste par ligne. Préfixe « - » = interdit, « + » = permis.';

  const save = async () => {
    if (!f.titre.trim()) return;
    await saveSecurite({ ...f, titre: f.titre.trim() });
    onSaved();
  };
  const remove = async () => {
    await deleteSecurite(f.id);
    onSaved();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>Fiche — {TYPE_LABEL[f.type]}</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        <div className="sheet__list">
          <div className="field">
            <label>Titre</label>
            <input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label>Contenu ({placeholder})</label>
            <textarea
              rows={5}
              value={f.contenu}
              onChange={(e) => setF({ ...f, contenu: e.target.value })}
            />
          </div>
          <div className="field">
            <label>العنوان بالدارجة (اختياري)</label>
            <input dir="rtl" value={f.titre_ar ?? ''} onChange={(e) => setF({ ...f, titre_ar: e.target.value })} />
          </div>
          <div className="field">
            <label>المحتوى بالدارجة (اختياري — relecture parent obligatoire)</label>
            <textarea
              dir="rtl"
              rows={5}
              value={f.contenu_ar ?? ''}
              onChange={(e) => setF({ ...f, contenu_ar: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Statut</label>
            <select
              value={f.statut}
              onChange={(e) => setF({ ...f, statut: e.target.value as SecuriteFiche['statut'] })}
            >
              <option value="Test">Test (non diffusé)</option>
              <option value="Validé">Validé (diffusé aux personnes assignées)</option>
              <option value="Écarté">Écarté (archivé)</option>
            </select>
          </div>

          <div className="field">
            <label>Note vocale du parent (sa voix = référence)</label>
            <VoiceNote recipeId={f.id} recipeName={f.titre} lang="fr" />
          </div>

          <button className="btn" onClick={save} disabled={!f.titre.trim()}>
            Enregistrer
          </button>
          <button className="lib-toggle" style={{ marginTop: 8 }} onClick={remove}>
            Supprimer la fiche
          </button>
        </div>
      </div>
    </div>
  );
}
