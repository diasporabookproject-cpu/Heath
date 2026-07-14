import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLE_LABEL, type Recipe } from '../types';
import { cleanText } from '../lib/sanitize';
import { PACKS } from '../data/packs';
import { isPackInstalled } from '../lib/packs';
import { IconSearch, IconMic, IconFav } from './icons';
import RelectureSheet from './RelectureSheet';

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
  onOpenCollections: (packId?: string) => void;
  toast: (m: string) => void;
}

/** FC5/FC15/FC18 — Bibliothèque : rôles, favoris, statuts, validation 1-tap. */
export default function RecettesView({ voiceIds, filter, setFilter, onOpenRecipe, onOpenCollections, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const toggleFav = useStore((s) => s.toggleFav);
  const suivi = useStore((s) => s.suivi); // F2.2 #1 : kcal/gP des cartes sous le flag
  const [q, setQ] = useState('');
  const [relire, setRelire] = useState<{ startId?: string } | null>(null);

  // File de relecture (L3-3) : périmètre = tous les brouillons `Test`.
  const draftCount = useMemo(() => recipes.filter((r) => r.statut === 'Test').length, [recipes]);

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

      {draftCount > 0 && (
        <div className="cz-pad" style={{ paddingTop: 8, paddingBottom: 0 }}>
          <button className="cz-sigrow" onClick={() => setRelire({})}>
            <span className="e">✦</span>
            <span className="st">
              <b>{draftCount} brouillon{draftCount > 1 ? 's' : ''} IA à relire</b>
              <i>2 minutes et c’est réglé</i>
            </span>
            <span className="go">Relire</span>
          </button>
        </div>
      )}

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
                onClick={() => (draft ? setRelire({ startId: r.id }) : onOpenRecipe(r.id))}
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
                  <span className="nm clamp2" style={{ flex: 1, fontWeight: 600 }}>
                    {cleanText(r.nom)}
                  </span>
                  {draft && <span className="cz-tag draft">✦ À valider</span>}
                  <span className="cz-tag role">{ROLE_LABEL[r.role]}</span>
                </div>
                {(suivi || voiceIds.has(r.id)) && (
                  <div className="cz-macros">
                    {suivi && macro(r)}
                    {voiceIds.has(r.id) && (
                      <span className="cz-vchip">
                        <IconMic size={11} />
                        vocal
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Collections (L3-4) — l'anti-page-blanche : des packs à copier chez soi. */}
      <div className="cz-collab">Collections — à copier, puis à toi</div>
      <div className="cz-rail">
        {PACKS.map((p) => {
          const installed = isPackInstalled(p, recipes);
          return (
            <button key={p.id} className="cz-pkt" onClick={() => onOpenCollections(p.id)}>
              {!installed && <span className="cz-newb">NOUVEAU</span>}
              <span className="cz-cov">{p.emoji}</span>
              <h5>{p.nom}</h5>
              <i>{p.recettes.length} RECETTES</i>
            </button>
          );
        })}
        <button className="cz-pkt more" onClick={() => onOpenCollections()}>
          Tout voir →
        </button>
      </div>

      {relire && (
        <RelectureSheet
          startId={relire.startId}
          onClose={() => setRelire(null)}
          onOpenRecipe={onOpenRecipe}
          toast={toast}
        />
      )}
    </div>
  );
}
