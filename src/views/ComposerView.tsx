import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { assessDay, weekAverages } from '../lib/nutrition';
import type { Recipe, RecipeType } from '../types';
import Totals from '../components/Totals';
import RecipePicker from '../components/RecipePicker';

type PickerTarget =
  | { dayKey: string; kind: 'dej' | 'din' }
  | { dayKey: string; kind: 'extra' }
  | null;

export default function ComposerView() {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const setSlot = useStore((s) => s.setSlot);
  const addExtra = useStore((s) => s.addExtra);
  const removeExtra = useStore((s) => s.removeExtra);

  const [target, setTarget] = useState<PickerTarget>(null);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const avg = useMemo(
    () => weekAverages(SEED_CONFIG, week.days, byId),
    [week.days, byId],
  );

  const pickerType: RecipeType | null = target
    ? target.kind === 'dej'
      ? 'Déjeuner'
      : target.kind === 'din'
        ? 'Dîner'
        : 'Coupe-faim'
    : null;

  return (
    <div>
      {/* Bandeau moyenne semaine — calcium mis en évidence (enjeu n°1) */}
      <div className="card weekbar">
        <div className="weekbar__title">Moyenne de la semaine · par jour</div>
        <Totals
          totals={avg.perDay}
          cibleKcal={Math.round(
            SEED_CONFIG.jours.reduce((s, j) => s + j.cible_kcal, 0) / SEED_CONFIG.jours.length,
          )}
          feux={{ kcal: 'vert', proteines: avg.feux.proteines, calcium: avg.feux.calcium }}
        />
      </div>

      {SEED_CONFIG.jours.map((jour) => {
        const day = week.days[jour.key];
        const a = assessDay(jour, day, byId, SEED_CONFIG);
        const dej = day.dejId ? byId.get(day.dejId) : undefined;
        const din = day.dinId ? byId.get(day.dinId) : undefined;
        return (
          <div className="card daycard" key={jour.key}>
            <div className="daycard__head">
              <span className="daycard__name">{jour.nom}</span>
              <span className="daycard__type">
                {jour.type} · cible {a.cibleKcal} kcal
              </span>
            </div>

            <Slot
              label="Déjeuner"
              recipe={dej}
              onClick={() => setTarget({ dayKey: jour.key, kind: 'dej' })}
            />
            <Slot
              label="Dîner"
              recipe={din}
              onClick={() => setTarget({ dayKey: jour.key, kind: 'din' })}
            />

            <div className="extras">
              {day.extras.map((id) => {
                const r = byId.get(id);
                return (
                  <button
                    key={id}
                    className="extra-chip"
                    onClick={() => removeExtra(jour.key, id)}
                    title="Retirer l'extra"
                  >
                    {r?.nom ?? id} (+{r?.kcal ?? 0}) <span className="extra-chip__x">×</span>
                  </button>
                );
              })}
              <button
                className="btn-add-extra"
                onClick={() => setTarget({ dayKey: jour.key, kind: 'extra' })}
              >
                + extra (Creami…)
              </button>
            </div>

            <Totals totals={a.totals} cibleKcal={a.cibleKcal} feux={a.feux} />
          </div>
        );
      })}

      {target && pickerType && (
        <RecipePicker
          title={
            target.kind === 'extra'
              ? 'Ajouter un extra'
              : target.kind === 'dej'
                ? 'Choisir un déjeuner'
                : 'Choisir un dîner'
          }
          type={pickerType}
          recipes={recipes}
          selectedId={
            target.kind === 'dej'
              ? week.days[target.dayKey].dejId
              : target.kind === 'din'
                ? week.days[target.dayKey].dinId
                : null
          }
          allowClear={target.kind !== 'extra'}
          onPick={(id) => {
            if (target.kind === 'extra') addExtra(target.dayKey, id);
            else setSlot(target.dayKey, target.kind, id);
          }}
          onClear={() => {
            if (target.kind !== 'extra') setSlot(target.dayKey, target.kind, null);
          }}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function Slot({
  label,
  recipe,
  onClick,
}: {
  label: string;
  recipe: Recipe | undefined;
  onClick: () => void;
}) {
  return (
    <button className="slot" onClick={onClick}>
      <span className="slot__label">{label}</span>
      <span className="slot__value">
        {recipe ? (
          <>
            <div>{recipe.nom}</div>
            <div className="slot__meta">
              {recipe.kcal} kcal · P {recipe.prot} · Ca {recipe.calcium} mg
            </div>
          </>
        ) : (
          <span className="slot__value--empty">Choisir…</span>
        )}
      </span>
      <span className="slot__chev">›</span>
    </button>
  );
}
