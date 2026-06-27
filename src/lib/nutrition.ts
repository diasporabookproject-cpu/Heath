import type { AccRef, AppConfig, DayMenu, Macros, MealKey, MealSlot, Recipe } from '../types';

// Moteur nutritionnel — Cuisine v2.
// Repas = composants (plat + entrée + accompagnement). Macros du repas = somme.
// Plus de socle, plus de type de jour : un objectif individuel (plafond) par personne.
// Macros stockées PAR PORTION (plat/entrée) et PAR 100 g (accompagnement).

const EMPTY: Macros = { kcal: 0, prot: 0, gluc: 0, lip: 0, calcium: 0 };

function recipeMacros(r: Recipe | undefined): Macros {
  if (!r) return EMPTY;
  return { kcal: r.kcal, prot: r.prot, gluc: r.gluc, lip: r.lip, calcium: r.calcium };
}

function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    gluc: a.gluc + b.gluc,
    lip: a.lip + b.lip,
    calcium: a.calcium + b.calcium,
  };
}

function scale(m: Macros, f: number): Macros {
  return { kcal: m.kcal * f, prot: m.prot * f, gluc: m.gluc * f, lip: m.lip * f, calcium: m.calcium * f };
}

/** Macros d'un composant. L'accompagnement est mis à l'échelle de sa quantité (g). */
export function componentMacros(
  slot: 'plat' | 'entree' | 'acc',
  value: string | AccRef | null | undefined,
  byId: Map<string, Recipe>,
): Macros {
  if (!value) return EMPTY;
  if (slot === 'acc') {
    const ref = value as AccRef;
    const r = byId.get(ref.id);
    return r ? scale(recipeMacros(r), ref.g / 100) : EMPTY;
  }
  return recipeMacros(byId.get(value as string));
}

/** Macros d'un repas = somme de ses composants (le petit-déj n'a que le plat). */
export function mealMacros(meal: MealSlot, key: MealKey, byId: Map<string, Recipe>): Macros {
  let total = componentMacros('plat', meal.plat, byId);
  if (key !== 'petitdej') {
    total = add(total, componentMacros('entree', meal.entree ?? null, byId));
    total = add(total, componentMacros('acc', meal.acc ?? null, byId));
  }
  return total;
}

/** Total de la journée (par personne) = somme des 3 repas. */
export function dayMacros(day: DayMenu, byId: Map<string, Recipe>): Macros {
  return add(
    add(mealMacros(day.petitdej, 'petitdej', byId), mealMacros(day.dej, 'dej', byId)),
    mealMacros(day.diner, 'diner', byId),
  );
}

export function dayComplete(day: DayMenu): boolean {
  return !!(day.petitdej.plat && day.dej.plat && day.diner.plat);
}

export function dayHasAny(day: DayMenu): boolean {
  return !!(
    day.petitdej.plat ||
    day.dej.plat ||
    day.dej.entree ||
    day.dej.acc ||
    day.diner.plat ||
    day.diner.entree ||
    day.diner.acc
  );
}

/** Un composant du repas est-il « à valider » (statut Test) ? */
export function mealHasDraft(meal: MealSlot, key: MealKey, byId: Map<string, Recipe>): boolean {
  const ids: (string | null | undefined)[] = [meal.plat];
  if (key !== 'petitdej') {
    ids.push(meal.entree);
    if (meal.acc) ids.push(meal.acc.id);
  }
  return ids.some((id) => {
    if (!id) return false;
    const r = byId.get(id);
    return !!r && r.statut === 'Test';
  });
}

export interface ObjectiveStatus {
  cls: 'ok' | 'warn' | 'bad';
  word: string;
}

/**
 * Statut d'une journée vs l'objectif individuel (plafond) :
 *  ≤ 85 % → « sous l'objectif » (ok) · ≤ objectif → « dans l'objectif » (ok)
 *  ≤ +10 % → « léger dépassement » (orange) · au-delà → « objectif dépassé » (rouge)
 */
export function objectiveStatus(totalKcal: number, objective: number): ObjectiveStatus {
  if (objective <= 0) return { cls: 'bad', word: 'objectif dépassé' };
  if (totalKcal <= objective * 0.85) return { cls: 'ok', word: 'sous l’objectif' };
  if (totalKcal <= objective) return { cls: 'ok', word: 'dans l’objectif' };
  if (totalKcal <= objective * 1.1) return { cls: 'warn', word: 'léger dépassement' };
  return { cls: 'bad', word: 'objectif dépassé' };
}

export interface WeekAverage {
  kcal: number;
  prot: number;
  /** Nombre de jours complets (les 3 repas composés) pris dans la moyenne. */
  count: number;
}

/** Moyenne par jour, calculée seulement sur les jours complets. */
export function weekAverage(
  config: AppConfig,
  days: Record<string, DayMenu>,
  byId: Map<string, Recipe>,
): WeekAverage {
  const complete = config.jours
    .map((j) => days[j.key])
    .filter((d): d is DayMenu => !!d)
    .filter(dayComplete);
  if (complete.length === 0) return { kcal: 0, prot: 0, count: 0 };
  let sumK = 0;
  let sumP = 0;
  for (const d of complete) {
    const m = dayMacros(d, byId);
    sumK += m.kcal;
    sumP += m.prot;
  }
  return {
    kcal: Math.round(sumK / complete.length),
    prot: Math.round(sumP / complete.length),
    count: complete.length,
  };
}

// Poids de répartition du budget calorique entre repas (petit-déj plus léger).
const MEAL_WEIGHT: Record<MealKey, number> = { petitdej: 0.28, dej: 0.4, diner: 0.4 };
const MEAL_FLOOR = 250; // plancher kcal par repas généré

/**
 * FC16 — Cible kcal par repas VIDE à générer : on répartit le budget restant
 * (objectif − déjà rempli) entre les repas vides, avec un plancher.
 */
export function mealBudgets(
  emptyKeys: MealKey[],
  filledKcal: number,
  objective: number,
): Record<string, number> {
  const wsum = emptyKeys.reduce((s, k) => s + MEAL_WEIGHT[k], 0);
  const budget = Math.max(0, objective - filledKcal);
  const out: Record<string, number> = {};
  for (const k of emptyKeys) {
    const part = wsum > 0 ? (budget * MEAL_WEIGHT[k]) / wsum : 0;
    out[k] = Math.max(MEAL_FLOOR, Math.round(part));
  }
  return out;
}

export function emptyMeal(full: boolean): MealSlot {
  return full ? { plat: null, entree: null, acc: null } : { plat: null };
}

export function emptyDay(): DayMenu {
  return { petitdej: emptyMeal(false), dej: emptyMeal(true), diner: emptyMeal(true) };
}
