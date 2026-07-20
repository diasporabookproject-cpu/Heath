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
    day.gouter?.plat ||
    day.diner.plat ||
    day.diner.entree ||
    day.diner.acc
  );
}

/** Ce créneau a-t-il AU MOINS un composant ? (critère « vide » des cartes et
 * du routage radial/composeur — un repas entrée-seule reste un repas.) */
export function mealHasAny(meal: MealSlot | undefined): boolean {
  return !!(meal && (meal.plat || meal.entree || meal.acc));
}

/** Un composant du repas est-il « à valider » (statut Test) ?
 * `meal` peut être ABSENT (jour stocké/synchronisé sans `gouter`) → false. */
export function mealHasDraft(meal: MealSlot | undefined, key: MealKey, byId: Map<string, Recipe>): boolean {
  if (!meal) return false;
  const ids: (string | null | undefined)[] = [meal.plat];
  if (key === 'dej' || key === 'diner') {
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
  return { petitdej: emptyMeal(false), dej: emptyMeal(true), gouter: emptyMeal(false), diner: emptyMeal(true) };
}
