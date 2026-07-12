import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import {
  dayMacros,
  dayHasAny,
  mealMacros,
  mealHasDraft,
  mealBudgets,
  objectiveStatus,
  weekAverage,
} from '../lib/nutrition';
import { aiAvailable, generateRecipeDraft, type RecipeDraft } from '../lib/ai';
import { estimateMacrosLocal } from '../lib/macros';
import { nextRecipeId } from '../lib/recipeId';
import { ROLE_LABEL, type CalciumFlag, type MealKey, type Recipe, type RecipeRole } from '../types';
import { weekDatesOffset, weekLabelOffset, weekSub, dayLabel } from './dates';
import { IconChevL, IconChevR, IconSpark, IconStar, IconPlus, IconCopy, IconLoader } from './icons';

const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit-déj', dej: 'Déjeuner', diner: 'Dîner' };
const MEAL_KEYS: MealKey[] = ['petitdej', 'dej', 'diner'];
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

/** Exécute `worker` sur `items` avec une concurrence limitée. */
async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency = 4): Promise<R[]> {
  const results = new Array(items.length) as R[];
  let i = 0;
  const next = async (): Promise<void> => {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await worker(items[idx]);
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

function recipeFromDraft(id: string, role: RecipeRole, d: RecipeDraft): Recipe {
  const hasMacros = Number(d.kcal) > 0;
  const est = hasMacros ? null : estimateMacrosLocal(d.ingredients ?? '');
  return {
    id,
    nom: d.nom?.trim() || `${ROLE_LABEL[role]} (IA)`,
    role,
    statut: 'Test',
    kcal: hasMacros ? Math.round(Number(d.kcal)) : est!.kcal,
    prot: hasMacros ? Math.round(Number(d.prot) || 0) : est!.prot,
    gluc: hasMacros ? Math.round(Number(d.gluc) || 0) : est!.gluc,
    lip: hasMacros ? Math.round(Number(d.lip) || 0) : est!.lip,
    calcium: hasMacros ? Math.round(Number(d.calcium) || 0) : est!.calcium,
    flag_calcium: (d.flag_calcium as CalciumFlag) || (est ? est.flag_calcium : 'Moyen'),
    ingredients: d.ingredients?.trim() || '',
    etapes: d.etapes?.trim() || undefined,
    macros_estimees: true,
    nom_ar: d.nom_ar?.trim() || undefined,
    ingredients_ar: d.ingredients_ar?.trim() || undefined,
    etapes_ar: d.etapes_ar?.trim() || undefined,
  };
}

interface Props {
  voiceIds: Set<string>;
  onOpenMeal: (dayKey: string, meal: MealKey) => void;
  onCopyWeek: () => void;
  onGoValidate: () => void;
  /** F5b (Flow FTUE) : biblio vide → proposer d'installer une collection au lieu de partir en IA. */
  onOpenCollections: (packId?: string) => void;
  toast: (msg: string) => void;
}

export default function SemaineView({ onOpenMeal, onCopyWeek, onGoValidate, onOpenCollections, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const weekOffset = useStore((s) => s.weekOffset);
  const navWeek = useStore((s) => s.navWeek);
  const objective = useStore((s) => s.settings.objective);
  const setComponent = useStore((s) => s.setComponent);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [busy, setBusy] = useState(false);

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

  // FC16 — complète UNIQUEMENT les repas vides par IA, dimensionnés sous l'objectif.
  const generate = async () => {
    if (busy) return;
    // F5b (Flow FTUE) : bibliothèque VIDE → générer partirait TOUT en IA (connexion +
    // quota). On propose d'abord la collection — copie sobre, pas de blocage sec.
    if (recipes.length === 0) {
      toast('Ta bibliothèque est vide — installe d’abord une collection de recettes');
      onOpenCollections('fonds-de-depart');
      return;
    }
    if (!(await aiAvailable())) {
      toast('Génération IA indisponible (hors-ligne / non connecté)');
      return;
    }
    const tasks: { dayKey: string; mealKey: MealKey; role: RecipeRole; target: number }[] = [];
    for (const j of SEED_CONFIG.jours) {
      const d = week.days[j.key];
      const empties = MEAL_KEYS.filter((k) => !d[k].plat);
      if (empties.length === 0) continue;
      const budgets = mealBudgets(empties, dayMacros(d, byId).kcal, objective);
      for (const k of empties) {
        tasks.push({ dayKey: j.key, mealKey: k, role: k === 'petitdej' ? 'petitdej' : 'plat', target: budgets[k] });
      }
    }
    if (tasks.length === 0) {
      toast('Aucun repas vide à compléter');
      return;
    }
    setBusy(true);
    // FIX revue Q (P2) : le générateur consomme le quota IA SERVEUR — un 429
    // « quota atteint » doit se dire clairement, pas en « indisponible » générique.
    let quotaHit = false;
    try {
      const drafts = await runPool(
        tasks,
        async (t) => {
          try {
            const intention = `${ROLE_LABEL[t.role]} équilibré, sans gluten, ~${t.target} kcal pour 1 portion`;
            return { t, d: await generateRecipeDraft(intention) };
          } catch (e) {
            if (/quota/i.test((e as Error)?.message ?? '')) quotaHit = true;
            return null;
          }
        },
        4,
      );
      const pool = [...recipes];
      let n = 0;
      for (const r of drafts) {
        if (!r) continue;
        const id = nextRecipeId(pool, r.t.role);
        const rec = recipeFromDraft(id, r.t.role, r.d);
        pool.push(rec);
        upsertRecipe(rec);
        setComponent(r.t.dayKey, r.t.mealKey, 'plat', id);
        n++;
      }
      toast(
        n
          ? `${n} repas complété${n > 1 ? 's' : ''} par l’IA — à valider`
          : quotaHit
            ? 'Quota IA du mois atteint — réessaie le mois prochain'
            : 'Génération indisponible',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cz-weeknav">
        <button className="cz-navchev" aria-label="Précédente" onClick={() => void navWeek(-1)}>
          <IconChevL size={16} />
        </button>
        <span className="cz-wk">
          {weekLabelOffset(weekOffset)}
          <small>{weekSub(weekOffset)}</small>
        </span>
        <button className="cz-navchev" aria-label="Suivante" onClick={() => void navWeek(1)}>
          <IconChevR size={16} />
        </button>
      </div>

      <div className="cz-pad">
        <div className="cz-summary">
          {avg.count === 0 ? (
            <>
              <div className="cz-slab">Cette semaine</div>
              <div className="cz-sval">—</div>
              <div className="cz-sempty">Semaine vide — compose tes repas ou lance une génération.</div>
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

      <button className="cz-genbtn" onClick={generate} disabled={busy}>
        {busy ? <IconLoader size={18} className="cz-spin" /> : <IconSpark size={18} />}
        {busy ? 'Génération des repas vides…' : 'Générer la semaine'}
      </button>
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
                  onClick={() => onOpenMeal(jour.key, k)}
                />
              ))}

              {hasAny ? (
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
              )}
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
  onClick,
}: {
  label: string;
  meal: import('../types').MealSlot;
  mealKey: MealKey;
  byId: Map<string, Recipe>;
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
      <span className="mk2">{fmt(mealMacros(meal, mealKey, byId).kcal)}</span>
      <span className="chev">
        <IconChevR size={16} />
      </span>
    </button>
  );
}
