import type { DayMenu, MealKey, MealSlot, Recipe } from '../types';

// Structure du menu — Cuisine v2. (Lot simplification : le moteur nutritionnel
// — macros, calcium, objectif, moyennes — a été RETIRÉ ; ne restent que les
// helpers de STRUCTURE : « ce jour/repas a-t-il du contenu / un brouillon ? ».)

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

export function emptyMeal(full: boolean): MealSlot {
  return full ? { plat: null, entree: null, acc: null } : { plat: null };
}

export function emptyDay(): DayMenu {
  return { petitdej: emptyMeal(false), dej: emptyMeal(true), diner: emptyMeal(true) };
}
