import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { ROLE_LABEL, type RecipeRole } from '../types';
import { pickable } from '../lib/picker';
import { cleanText } from '../lib/sanitize';
import { recipeEmoji } from '../lib/emoji';
import { SECTIONS } from './RecettesView';
import { IconSearch, IconMic, IconFav, IconPlus } from './icons';
import Em from '../ui/Em';

interface Props {
  role: RecipeRole;
  sub: string;
  voiceIds: Set<string>;
  onPick: (id: string) => void;
  /** T4 (SPEC 5) : « ＋ Nouvelle recette » DÉPLIE les 3 voies EN PLACE (pas de
   * 2ᵉ feuille de choix) — chaque voie ouvre directement son formulaire. */
  onNewRecipe: (step: 'ecrire' | 'instructions') => void;
  onCollections: () => void;
  onClose: () => void;
}

/** FC12/FC15 — Sélecteur d'un composant : recettes Validé du rôle, favoris en tête. */
export default function RecipePickerSheet({ role, sub, voiceIds, onPick, onNewRecipe, onCollections, onClose }: Props) {
  const recipes = useStore((s) => s.recipes);
  const toggleFav = useStore((s) => s.toggleFav);
  const [q, setQ] = useState('');
  const [ways, setWays] = useState(false);
  const [folded, setFolded] = useState<Set<RecipeRole>>(new Set());
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const bySection = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Règle d'éligibilité EXTRAITE (lib/picker) : Validé seulement (verrou G2,
    // testé) + soupe éligible entrée/plat (F5.2).
    const list = pickable(recipes, role)
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr'));
    // Retour device PO (lot UI) : MÊME interface que l'onglet Recettes (T5) —
    // sections par moment repliables, lignes chip-emoji + étoile fantôme.
    return SECTIONS.map((s) => ({ ...s, items: list.filter((r) => r.role === s.role) })).filter(
      (s) => s.items.length > 0,
    );
  }, [recipes, role, q]);

  const toggleFold = (r: RecipeRole) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });


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
          {/* Amendement ② + T4 : créer sans quitter le geste — les 3 voies se
              déplient ICI (jamais une 2ᵉ feuille de choix). */}
          {ways ? (
            <div className="cz-ways" style={{ marginTop: 10 }}>
              <button className="cz-way" onClick={() => onNewRecipe('ecrire')}>
                <span className="we"><Em ch="✏️" size={20} /></span>
                <b>L’écrire</b>
              </button>
              <button className="cz-way" onClick={() => onNewRecipe('instructions')}>
                <span className="we"><Em ch="📸" size={20} /></span>
                <b>Photo ou lien</b>
              </button>
              <button className="cz-way" onClick={onCollections}>
                <span className="we"><Em ch="📚" size={20} /></span>
                <b>Une collection</b>
              </button>
            </div>
          ) : (
            <button className="cz-addcomp" style={{ marginTop: 10 }} onClick={() => setWays(true)}>
              <IconPlus size={16} /> Nouvelle recette
            </button>
          )}
          {bySection.length === 0 ? (
            <p className="cz-emptynote">Aucune recette validée pour ce rôle.</p>
          ) : (
            <div style={{ paddingTop: 6 }}>
              {bySection.map((sec) => {
                const open = !folded.has(sec.role);
                return (
                  <div key={sec.role}>
                    <button className="cz-sech" style={{ padding: '8px 2px 6px' }} onClick={() => toggleFold(sec.role)} aria-expanded={open}>
                      <b>{sec.label}</b>
                      <span className="ct">{sec.items.length}</span>
                      <span className="cv">{open ? '⌄' : '›'}</span>
                    </button>
                    {open &&
                      sec.items.map((r) => (
                        <button key={r.id} className="cz-librow cz-pick" onClick={() => onPick(r.id)}>
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
                            <span className="cz-remoji">
                              <Em ch={recipeEmoji(r)} size={24} />
                            </span>
                            <span className="nm clamp2" style={{ flex: 1, fontWeight: 600 }}>
                              {cleanText(r.nom)}
                            </span>
                          </div>
                          {voiceIds.has(r.id) && (
                            <div className="cz-cardmeta">
                              <span className="cz-vchip">
                                <IconMic size={11} />
                                vocal
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
