import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ROLE_LABEL, type Recipe, type RecipeRole } from '../types';
import { IconSearch, IconMic, IconFav } from './icons';

interface Props {
  role: RecipeRole;
  sub: string;
  voiceIds: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** FC12/FC15 — Sélecteur d'un composant : recettes Validé du rôle, favoris en tête. */
export default function RecipePickerSheet({ role, sub, voiceIds, onPick, onClose }: Props) {
  const recipes = useStore((s) => s.recipes);
  const toggleFav = useStore((s) => s.toggleFav);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => r.role === role && r.statut === 'Validé')
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr'));
  }, [recipes, role, q]);

  const macroText = (r: Recipe) =>
    r.role === 'acc' ? (
      <>
        <b>{r.kcal}</b> kcal/100g · <b>{r.prot}</b>g P
      </>
    ) : (
      <>
        <b>{r.kcal}</b> kcal · <b>{r.prot}</b>g P
      </>
    );

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Choisir : {ROLE_LABEL[role]}
            <small>{sub}</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-search">
            <IconSearch size={18} />
            <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          {list.length === 0 ? (
            <p className="cz-emptynote">Aucune recette validée pour ce rôle.</p>
          ) : (
            <div style={{ paddingTop: 10 }}>
              {list.map((r) => (
                <button key={r.id} className="cz-pick" onClick={() => onPick(r.id)}>
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
                    <span className="cz-tag role">{ROLE_LABEL[r.role]}</span>
                  </div>
                  <div className="cz-macros">
                    <span>{macroText(r)}</span>
                    {voiceIds.has(r.id) && (
                      <span className="cz-vchip">
                        <IconMic size={11} />
                        vocal
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
