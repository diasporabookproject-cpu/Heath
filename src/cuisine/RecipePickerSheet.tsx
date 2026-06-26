import { useEffect, useMemo, useState } from 'react';
import type { Recipe, RecipeType } from '../types';
import { IconSearch, IconMic } from './icons';

interface Props {
  title: string;
  sub: string;
  type: RecipeType;
  recipes: Recipe[];
  voiceIds: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

const flagClass = (f: Recipe['flag_calcium']) =>
  f === 'Champion' ? 'champion' : f === 'Moyen' ? 'moyen' : 'faible';

/**
 * FC3 — Sélecteur de recette (bottom-sheet).
 * Seules les recettes « Validé » du type du créneau apparaissent ; recherche ;
 * filtre « Calcium champion » ; le calcium EST montré ici (aide au choix).
 */
export default function RecipePickerSheet({
  title,
  sub,
  type,
  recipes,
  voiceIds,
  onPick,
  onClose,
}: Props) {
  const [q, setQ] = useState('');
  const [champOnly, setChampOnly] = useState(false);
  const [shown, setShown] = useState(false);

  // Animation d'entrée (translateY) au montage.
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => r.type === type && r.statut === 'Validé')
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .filter((r) => (champOnly ? r.flag_calcium === 'Champion' : true))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [recipes, type, q, champOnly]);

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {title}
            <small>{sub}</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-search">
            <IconSearch size={18} />
            <input
              placeholder="Rechercher une recette…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="cz-chips">
            <button
              className="cz-chip ca"
              aria-pressed={champOnly}
              onClick={() => setChampOnly((v) => !v)}
            >
              ◆ Calcium champion
            </button>
          </div>

          {list.length === 0 ? (
            <p className="cz-emptynote">Aucune recette validée ne correspond.</p>
          ) : (
            list.map((r) => (
              <button key={r.id} className="cz-pick" onClick={() => onPick(r.id)}>
                <div className="cz-libtop">
                  <span className="nm">{r.nom}</span>
                  <span className={'cz-caflag ' + flagClass(r.flag_calcium)}>◆ {r.calcium} mg</span>
                </div>
                <div className="cz-macros">
                  <span>
                    <b>{r.kcal}</b> kcal
                  </span>
                  <span>
                    <b>{r.prot}</b>g P
                  </span>
                  {voiceIds.has(r.id) && (
                    <span className="cz-vchip">
                      <IconMic size={11} />
                      vocal
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
