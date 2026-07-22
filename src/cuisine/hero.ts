import type { DayMenu, MealKey } from '../types';
import { mealHasAny } from '../lib/menu';

// Refonte T1 (mise en page Cuisine) — choix du repas HÉROS de la vue jour.
// Logique pure, isolée pour être testée sans monter le composant.

/** Heures conventionnelles — MIROIR de `maison/prochain.ts` (décision produit non
 *  réglable). À garder aligné si un jour ça bouge. */
export const MEAL_HOURS: Record<MealKey, string> = { petitdej: '08:00', dej: '12:30', gouter: '16:30', diner: '20:00' };

const KEYS: MealKey[] = ['petitdej', 'dej', 'gouter', 'diner'];

/**
 * Repas HÉROS = le prochain repas à servir (un AFFICHAGE, pas une compose).
 * Aujourd'hui : premier repas REMPLI dont l'heure ≥ maintenant ; en soirée (tout
 * passé), le dernier rempli. Jour futur : premier rempli (rien n'est passé).
 * `null` = journée vide → l'appelant montre l'invitation. Toujours un repas
 * REMPLI → la carte héros est toujours riche (jamais un héros vide).
 */
export function pickHeroKey(day: DayMenu, isToday: boolean, now: string): MealKey | null {
  const filled = KEYS.filter((k) => mealHasAny(day[k]));
  if (filled.length === 0) return null;
  if (!isToday) return filled[0];
  return filled.find((k) => MEAL_HOURS[k] >= now) ?? filled[filled.length - 1];
}

/** HH:MM local — même repère que prochain.ts (choix du héros « prochain à servir »). */
export function nowHHMM(ref: Date = new Date()): string {
  return `${String(ref.getHours()).padStart(2, '0')}:${String(ref.getMinutes()).padStart(2, '0')}`;
}
