import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { prochainsCreneaux, type Creneau } from '../lib/creneaux';
import type { MealKey, Recipe } from '../types';
import { IconChevR } from './icons';

// F7.2 : Matin / Midi / Soir (libellés seuls — clés du modèle inchangées).
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit déjeuner', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner' };

/**
 * F6.1 (D1) — « Pour quel repas ? » : le DÉFAUT (prochain repas compatible,
 * lib/creneaux) est en tête — un seul tap suffit. Un créneau occupé ANNONCE ce
 * qu'il remplacera avant le tap : choisir = confirmer, jamais d'écrasement
 * silencieux. Après le choix, la recette est posée et le partage s'ouvre.
 */
export default function PourQuelRepasSheet({
  recipe,
  onPick,
  onClose,
}: {
  recipe: Recipe;
  onPick: (c: Creneau) => void;
  onClose: () => void;
}) {
  const week = useStore((s) => s.week);
  const recipes = useStore((s) => s.recipes);
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const creneaux = useMemo(
    () => prochainsCreneaux(recipe.role, new Date(), SEED_CONFIG, week, byId),
    [recipe.role, week, byId],
  );

  const dayNom = (k: string) => SEED_CONFIG.jours.find((j) => j.key === k)?.nom ?? k;
  const quand = (c: Creneau) =>
    c.dOffset === 0
      ? 'Aujourd’hui'
      : c.dOffset === 1
        ? 'Demain'
        : dayNom(c.dayKey) + (c.weekDelta === 1 ? ' (semaine prochaine)' : '');

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Pour quel repas ?
            <small>{recipe.nom} — un seul canal : le menu, puis l’envoi</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div style={{ paddingTop: 8 }}>
            {creneaux.map((c, i) => (
              <button key={`${c.weekDelta}-${c.dayKey}-${c.mealKey}`} className="cz-pick" onClick={() => onPick(c)}>
                <div className="cz-libtop">
                  <span className="nm" style={{ flex: 1, fontWeight: 600 }}>
                    {quand(c)} · {MEAL_LABEL[c.mealKey]}
                  </span>
                  {i === 0 && <span className="cz-tag ok">Prochain repas</span>}
                  <IconChevR size={16} />
                </div>
                {c.remplace && (
                  <div className="cz-cardmeta" style={{ marginTop: 4 }}>
                    <span>
                      remplacera : <b>{c.remplace}</b>
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
