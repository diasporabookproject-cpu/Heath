import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import type { MealKey, Recipe, RecipeRole } from '../types';
import { IconPlus, IconClose } from './icons';

// F7.2 : Matin / Midi / Soir (libellés seuls — clés du modèle inchangées).
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Matin', dej: 'Midi', diner: 'Soir' };
type Slot = 'plat' | 'entree' | 'acc';

interface Props {
  dayKey: string;
  dayNom: string;
  mealKey: MealKey;
  onPickSlot: (slot: Slot, role: RecipeRole) => void;
  onClose: () => void;
}

/** FC12 — Composeur de repas : plat + (entrée / accompagnement). */
export default function MealComposerSheet({ dayKey, dayNom, mealKey, onPickSlot, onClose }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const setComponent = useStore((s) => s.setComponent);
  const setAccQty = useStore((s) => s.setAccQty);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const meal = week.days[dayKey][mealKey];
  const full = mealKey !== 'petitdej';

  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const plat = meal.plat ? byId.get(meal.plat) : undefined;
  const entree = meal.entree ? byId.get(meal.entree) : undefined;
  const acc = meal.acc ? byId.get(meal.acc.id) : undefined;

  const Row = ({
    role,
    slot,
    recipe,
    removable,
  }: {
    role: string;
    slot: Slot;
    recipe: Recipe | undefined;
    removable?: boolean;
  }) => (
    <div className="cz-comp">
      <span className="crole">{role}</span>
      {recipe ? (
        <>
          <span className="cmid" onClick={() => onPickSlot(slot, recipe.role)}>
            <span className="cn">
              {recipe.nom}
              {recipe.statut === 'Test' && <span style={{ color: 'var(--draft)', fontSize: 11 }}> ✦</span>}
            </span>
          </span>
          {slot === 'acc' && meal.acc && (
            <span className="cz-qty">
              <button onClick={() => setAccQty(dayKey, mealKey, -25)}>−</button>
              <span className="qv">{meal.acc.g} g</span>
              <button onClick={() => setAccQty(dayKey, mealKey, 25)}>+</button>
            </span>
          )}
          {removable && (
            <button className="rm" aria-label="Retirer" onClick={() => setComponent(dayKey, mealKey, slot, null)}>
              <IconClose size={16} />
            </button>
          )}
        </>
      ) : (
        <span className="cmid" onClick={() => onPickSlot(slot, slot === 'plat' ? (full ? 'plat' : 'petitdej') : (slot as RecipeRole))}>
          <span className="cn empty">
            <IconPlus size={14} /> Choisir
          </span>
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {MEAL_LABEL[mealKey]}
            <small>{dayNom}</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-complist">
            <Row role={full ? 'Plat' : 'Petit-déj'} slot="plat" recipe={plat} />
            {full && entree && <Row role="Entrée" slot="entree" recipe={entree} removable />}
            {full && acc && <Row role="Accomp." slot="acc" recipe={acc} removable />}
          </div>

          {full && !meal.entree && (
            <button className="cz-addcomp" onClick={() => onPickSlot('entree', 'entree')}>
              <IconPlus size={16} /> Ajouter une entrée
            </button>
          )}
          {full && !meal.acc && (
            <button className="cz-addcomp" onClick={() => onPickSlot('acc', 'acc')}>
              <IconPlus size={16} /> Ajouter un accompagnement
            </button>
          )}
        </div>
      </div>
    </>
  );
}
