import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLE_LABEL, type Recipe } from '../types';
import { IconSearch, IconMic, IconFav } from './icons';

const CHIPS: { key: string; label: string; draft?: boolean }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'fav', label: '★ Favoris' },
  { key: 'petitdej', label: 'Petit-déj' },
  { key: 'entree', label: 'Entrée' },
  { key: 'plat', label: 'Plat' },
  { key: 'acc', label: 'Accomp.' },
  { key: 'draft', label: '✦ À valider', draft: true },
];

interface Props {
  voiceIds: Set<string>;
  filter: string;
  setFilter: (f: string) => void;
  onOpenRecipe: (id: string) => void;
  toast: (m: string) => void;
}

/** FC5/FC15/FC18 — Bibliothèque : rôles, favoris, statuts, validation 1-tap. */
export default function RecettesView({ voiceIds, filter, setFilter, onOpenRecipe, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const toggleFav = useStore((s) => s.toggleFav);
  const validateRecipe = useStore((s) => s.validateRecipe);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => r.statut !== 'Écarté')
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .filter((r) => {
        if (filter === 'all') return true;
        if (filter === 'fav') return !!r.fav;
        if (filter === 'draft') return r.statut === 'Test';
        return r.role === filter;
      })
      .sort(
        (a, b) =>
          (a.statut === 'Test' ? 0 : 1) - (b.statut === 'Test' ? 0 : 1) ||
          a.nom.localeCompare(b.nom, 'fr'),
      );
  }, [recipes, q, filter]);

  const macro = (r: Recipe) =>
    r.role === 'acc' ? (
      <span>
        <b>{r.kcal}</b> kcal/100g
      </span>
    ) : (
      <span>
        <b>{r.kcal}</b> kcal · <b>{r.prot}</b>g P
      </span>
    );

  return (
    <div>
      <div className="cz-pad" style={{ paddingTop: 0 }}>
        <div className="cz-search">
          <IconSearch size={18} />
          <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="cz-chips" style={{ paddingLeft: 16, paddingRight: 16 }}>
        {CHIPS.map((c) => (
          <button
            key={c.key}
            className={'cz-chip' + (c.draft ? ' dr' : '')}
            aria-pressed={filter === c.key}
            onClick={() => setFilter(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="cz-pad cz-lib">
        {list.length === 0 ? (
          <p className="cz-emptynote">Aucune recette ici.</p>
        ) : (
          list.map((r) => {
            const draft = r.statut === 'Test';
            return (
              <button
                key={r.id}
                className={'cz-librow' + (draft ? ' draft' : '')}
                onClick={() => onOpenRecipe(r.id)}
              >
                <div className="cz-libtop">
                  <span
                    className={'cz-starbtn' + (r.fav ? ' on' : '')}
                    role="button"
                    tabIndex={0}
                    aria-label="Favori"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(r.id);
                    }}
                  >
                    <IconFav size={16} filled={r.fav} />
                  </span>
                  <span className="nm" style={{ flex: 1, fontWeight: 600 }}>
                    {r.nom}
                  </span>
                  {draft && <span className="cz-tag draft">✦ À valider</span>}
                  <span className="cz-tag role">{ROLE_LABEL[r.role]}</span>
                </div>
                <div className="cz-macros">
                  {macro(r)}
                  {voiceIds.has(r.id) && (
                    <span className="cz-vchip">
                      <IconMic size={11} />
                      vocal
                    </span>
                  )}
                  {draft && (
                    <button
                      className="cz-vbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        validateRecipe(r.id);
                        toast('Recette validée');
                      }}
                    >
                      Valider
                    </button>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
