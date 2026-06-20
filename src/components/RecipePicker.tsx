import { useMemo, useState } from 'react';
import type { Recipe, RecipeType } from '../types';

interface Props {
  title: string;
  type: RecipeType;
  recipes: Recipe[];
  selectedId?: string | null;
  allowClear?: boolean;
  onPick: (id: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

export default function RecipePicker({
  title,
  type,
  recipes,
  selectedId,
  allowClear,
  onPick,
  onClear,
  onClose,
}: Props) {
  const [q, setQ] = useState('');

  // Seules les recettes « Validé » du bon type apparaissent dans les choix (§6.3).
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => r.type === type && r.statut === 'Validé')
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [recipes, type, q]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>{title}</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
          <input
            className="sheet__search"
            placeholder="Rechercher une recette…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        {allowClear && onClear && (
          <button
            className="sheet__clear"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Vider ce repas
          </button>
        )}

        <div className="sheet__list">
          {list.length === 0 && <p className="empty-note">Aucune recette « Validé » pour ce filtre.</p>}
          {list.map((r) => (
            <button
              key={r.id}
              className={'reci' + (r.id === selectedId ? ' reci--selected' : '')}
              onClick={() => {
                onPick(r.id);
                onClose();
              }}
            >
              <div className="reci__name">{r.nom}</div>
              <div className="reci__macros">
                <span>
                  <b>{r.kcal}</b> kcal
                </span>
                <span>
                  P <b>{r.prot}</b>
                </span>
                <span>
                  Ca <b>{r.calcium}</b> mg
                </span>
                <span className={'flag flag--' + r.flag_calcium}>{r.flag_calcium}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
