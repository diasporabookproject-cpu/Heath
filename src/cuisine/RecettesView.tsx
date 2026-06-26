import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Recipe } from '../types';
import { IconSearch, IconMic } from './icons';

const flagClass = (f: Recipe['flag_calcium']) =>
  f === 'Champion' ? 'champion' : f === 'Moyen' ? 'moyen' : 'faible';

const CHIPS: { key: string; label: string; draft?: boolean; ca?: boolean }[] = [
  { key: 'draft', label: '✦ À valider', draft: true },
  { key: 'Déjeuner', label: 'Déjeuner' },
  { key: 'Dîner', label: 'Dîner' },
  { key: 'Coupe-faim', label: 'Coupe-faim' },
  { key: 'champ', label: 'Calcium champion', ca: true },
];

interface Props {
  voiceIds: Set<string>;
  filters: Set<string>;
  setFilters: (f: Set<string>) => void;
  onOpenRecipe: (id: string) => void;
}

/** FC5 — Bibliothèque : liste filtrable, statuts (✦ À valider / Validé), calcium. */
export default function RecettesView({ voiceIds, filters, setFilters, onOpenRecipe }: Props) {
  const recipes = useStore((s) => s.recipes);
  const [q, setQ] = useState('');

  const toggle = (key: string) => {
    const n = new Set(filters);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    setFilters(n);
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const types = [...filters].filter((f) => f === 'Déjeuner' || f === 'Dîner' || f === 'Coupe-faim');
    return recipes
      .filter((r) => r.statut !== 'Écarté')
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .filter((r) => (filters.has('draft') ? r.statut === 'Test' : true))
      .filter((r) => (filters.has('champ') ? r.flag_calcium === 'Champion' : true))
      .filter((r) => (types.length ? types.includes(r.type) : true))
      .sort((a, b) => {
        const order = (s: Recipe['statut']) => (s === 'Test' ? 0 : 1); // à valider en tête
        return order(a.statut) - order(b.statut) || a.nom.localeCompare(b.nom, 'fr');
      });
  }, [recipes, q, filters]);

  return (
    <div>
      <div className="cz-pad" style={{ paddingTop: 0 }}>
        <div className="cz-search">
          <IconSearch size={18} />
          <input placeholder="Rechercher une recette…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="cz-chips" style={{ paddingLeft: 16, paddingRight: 16 }}>
        {CHIPS.map((c) => (
          <button
            key={c.key}
            className={'cz-chip' + (c.ca ? ' ca' : '')}
            aria-pressed={filters.has(c.key)}
            onClick={() => toggle(c.key)}
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
                  <span className="nm" style={{ fontWeight: 600, flex: 1 }}>{r.nom}</span>
                  {draft && <span className="cz-tag draft">✦ À valider</span>}
                  <span className={'cz-caflag ' + flagClass(r.flag_calcium)}>◆ {r.calcium} mg</span>
                </div>
                <div className="cz-macros">
                  <span className="cz-tag">{r.type}</span>
                  <span><b>{r.kcal}</b> kcal</span>
                  <span><b>{r.prot}</b>g P</span>
                  {(draft || r.macros_estimees) && <span className="cz-est">macros estimées</span>}
                  {voiceIds.has(r.id) && (
                    <span className="cz-vchip">
                      <IconMic size={11} />
                      vocal
                    </span>
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
