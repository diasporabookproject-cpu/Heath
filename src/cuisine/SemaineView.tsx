import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import {
  dayMacros,
  dayHasAny,
  mealMacros,
  mealHasDraft,
  objectiveStatus,
  weekAverage,
} from '../lib/nutrition';
import type { MealKey, Recipe } from '../types';
import { weekDatesOffset, weekSub, dayLabel } from './dates';
import { IconChevL, IconChevR, IconStar, IconPlus, IconCopy } from './icons';

const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit-déj', dej: 'Déjeuner', diner: 'Dîner' };
const MEAL_KEYS: MealKey[] = ['petitdej', 'dej', 'diner'];
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

// F1.2 (lot Cuisine, accord PO) : « Générer la semaine » est RETIRÉ — « proposer
// un repas » part au backlog. Le garde-fou F5b (biblio vide → proposer la
// collection), qui ne servait que ce bouton, meurt avec lui (réconcilié avec le
// rapport Q&A 338abfb au read-back). Le rail Collections reste la voie d'entrée.

interface Props {
  voiceIds: Set<string>;
  onOpenMeal: (dayKey: string, meal: MealKey) => void;
  onCopyWeek: () => void;
  onGoValidate: () => void;
}

export default function SemaineView({ onOpenMeal, onCopyWeek, onGoValidate }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const weekOffset = useStore((s) => s.weekOffset);
  const navWeek = useStore((s) => s.navWeek);
  const objective = useStore((s) => s.settings.objective);
  const suivi = useStore((s) => s.suivi); // F2.2 : gouverne TOUT l'affichage nutrition

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const dates = useMemo(() => weekDatesOffset(weekOffset), [weekOffset]);
  const avg = useMemo(() => weekAverage(SEED_CONFIG, week.days, byId), [week.days, byId]);

  const toValidate = useMemo(() => {
    const ids = new Set<string>();
    for (const j of SEED_CONFIG.jours) {
      const d = week.days[j.key];
      for (const k of MEAL_KEYS) {
        const m = d[k];
        for (const id of [m.plat, m.entree, m.acc?.id]) {
          if (!id) continue;
          const r = byId.get(id);
          if (r && r.statut === 'Test') ids.add(id);
        }
      }
    }
    return ids.size;
  }, [week.days, byId]);

  const avgStatus = objectiveStatus(avg.kcal, objective);
  const avgPct = Math.min(100, Math.round((avg.kcal / (objective || 1)) * 100));

  return (
    <div>
      <div className="cz-weeknav">
        <button className="cz-navchev" aria-label="Précédente" onClick={() => void navWeek(-1)}>
          <IconChevL size={16} />
        </button>
        {/* F1.3 : titre de vue = « menu de la semaine » (vocabulaire verrouillé) ; la date reste. */}
        <span className="cz-wk">
          Menu de la semaine
          <small>
            du {dayLabel(dates[0])} · {weekSub(weekOffset)}
          </small>
        </span>
        <button className="cz-navchev" aria-label="Suivante" onClick={() => void navWeek(1)}>
          <IconChevR size={16} />
        </button>
      </div>

      {/* F2.2 #10 : le résumé nutritionnel (moyenne/jour + jauge) n'existe que si le
          suivi est ON. OFF : seul le guidage d'état vide (pas un chiffre) subsiste. */}
      {(suivi || avg.count === 0) && (
        <div className="cz-pad">
          <div className="cz-summary">
            {avg.count === 0 ? (
              <>
                <div className="cz-slab">Cette semaine</div>
                {suivi && <div className="cz-sval">—</div>}
                <div className="cz-sempty">Semaine vide — compose tes repas ou copie une semaine.</div>
              </>
            ) : (
              <>
                <div className="cz-sumtop">
                  <div>
                    <div className="cz-slab">Moyenne / jour</div>
                    <div className="cz-sval">
                      {fmt(avg.kcal)}
                      <small>kcal · obj. {fmt(objective)}</small>
                    </div>
                  </div>
                  <div className="cz-sprot">
                    {avg.prot} g<small>protéines</small>
                  </div>
                </div>
                <div className="cz-sgauge">
                  <div
                    className="cz-sgfill"
                    style={{
                      width: avgPct + '%',
                      background: avgStatus.cls === 'ok' ? '#7BD3A0' : avgStatus.cls === 'warn' ? '#F4B860' : '#F0897A',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button className="cz-subgen" onClick={onCopyWeek}>
        <IconCopy size={15} />
        Copier une semaine précédente
      </button>

      {toValidate > 0 && (
        <button className="cz-vbanner" onClick={onGoValidate}>
          <span className="cz-vi">
            <IconStar size={18} />
          </span>
          <span className="cz-vt">
            {toValidate} recette{toValidate > 1 ? 's' : ''} à valider dans cette semaine
          </span>
          <IconChevR size={16} />
        </button>
      )}

      <div className="cz-days">
        {SEED_CONFIG.jours.map((jour, i) => {
          const day = week.days[jour.key];
          const hasAny = dayHasAny(day);
          const dk = dayMacros(day, byId).kcal;
          const status = objectiveStatus(dk, objective);
          const pct = Math.min(100, Math.round((dk / (objective || 1)) * 100));
          return (
            <div className="cz-daycard" key={jour.key}>
              <div className="cz-dayhead">
                <span className="cz-dayname">{jour.nom}</span>
                <span className="cz-daydate">{dayLabel(dates[i])}</span>
              </div>

              {MEAL_KEYS.map((k) => (
                <MealRow
                  key={k}
                  label={MEAL_LABEL[k]}
                  meal={day[k]}
                  mealKey={k}
                  byId={byId}
                  suivi={suivi}
                  onClick={() => onOpenMeal(jour.key, k)}
                />
              ))}

              {/* F2.2 : jauge du jour + bandeau « équilibre » (#8) = nutrition, sous le flag. */}
              {suivi &&
                (hasAny ? (
                  <div className="cz-gauge">
                    <div className="cz-gtrack">
                      <div className={'cz-gfill ' + status.cls} style={{ width: pct + '%' }} />
                      <div className="cz-gtick" style={{ left: '100%' }} />
                    </div>
                    <div className="cz-gmeta">
                      <span className="cz-gk">{fmt(dk)} kcal</span>
                      <span className={'cz-gstatus ' + status.cls}>{status.word}</span>
                    </div>
                  </div>
                ) : (
                  <div className="cz-gincomplete">Ajoute au moins un repas pour voir l’équilibre.</div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MealRow({
  label,
  meal,
  mealKey,
  byId,
  suivi,
  onClick,
}: {
  label: string;
  meal: import('../types').MealSlot;
  mealKey: MealKey;
  byId: Map<string, Recipe>;
  suivi: boolean;
  onClick: () => void;
}) {
  const plat = meal.plat ? byId.get(meal.plat) : undefined;
  if (!plat) {
    return (
      <button className="cz-mrow empty" onClick={onClick}>
        <span className="ml">{label}</span>
        <span className="mid">
          <span className="mn">
            <IconPlus size={15} /> Ajouter
          </span>
        </span>
        <span className="chev">
          <IconChevR size={16} />
        </span>
      </button>
    );
  }
  const sub: string[] = [];
  if (mealKey !== 'petitdej') {
    if (meal.entree) {
      const e = byId.get(meal.entree);
      if (e) sub.push('Entrée : ' + e.nom);
    }
    if (meal.acc) {
      const a = byId.get(meal.acc.id);
      if (a) sub.push(`${a.nom} ${meal.acc.g} g`);
    }
  }
  return (
    <button className="cz-mrow" onClick={onClick}>
      <span className="ml">{label}</span>
      <span className="mid">
        <span className="mn">
          {plat.nom}
          {mealHasDraft(meal, mealKey, byId) && (
            <span className="vio" title="à valider">
              <IconStar size={13} />
            </span>
          )}
        </span>
        {sub.length > 0 && <span className="sub">{sub.join(' · ')}</span>}
      </span>
      {suivi && <span className="mk2">{fmt(mealMacros(meal, mealKey, byId).kcal)}</span>}
      <span className="chev">
        <IconChevR size={16} />
      </span>
    </button>
  );
}
