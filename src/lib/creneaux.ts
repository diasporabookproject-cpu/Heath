import type { AppConfig, MealKey, Recipe, RecipeRole, WeekMenu } from '../types';

// F6.1 (lot Cuisine T6, décision D1) — « Partager » une fiche = l'AJOUTER AU MENU
// puis partager. Ce module est la règle PURE du « prochain repas à venir »,
// amendée Q3 par le PO : le défaut est le prochain créneau COMPATIBLE avec le
// MOMENT de la recette — petit-déj → prochain Matin ; tout le reste → prochain
// Midi/Soir — JAMAIS un plat posé au Matin. Seuils (reco validée) : avant 11 h →
// Midi aujourd'hui · 11-18 h → Soir aujourd'hui · après 18 h → Midi demain.

export interface Creneau {
  dayKey: string;
  mealKey: MealKey;
  /** 0 = semaine affichée (courante) ; 1 = la suivante (dimanche soir → lundi). */
  weekDelta: 0 | 1;
  slot: 'plat' | 'entree' | 'acc';
  /** Décalage en jours depuis aujourd'hui (0 = aujourd'hui, 1 = demain…). */
  dOffset: number;
  /** Nom du plat déjà en place — le choisir = REMPLACER, montré AVANT le tap
   * (jamais d'écrasement silencieux). Inconnu (undefined) sur la semaine suivante. */
  remplace?: string;
}

/** Le slot qu'occupe un moment dans un repas. null = pas de créneau en v1
 * (dessert / goûter / boisson — décision Q2) : le partage passe par les repas. */
export function slotForRole(role: RecipeRole): 'plat' | 'entree' | 'acc' | null {
  if (role === 'petitdej' || role === 'plat' || role === 'soupe') return 'plat';
  if (role === 'entree') return 'entree';
  if (role === 'acc') return 'acc';
  return null; // dessert · gouter · boisson
}

/** Prochains créneaux compatibles, DÉFAUT EN TÊTE. `now` injecté (testable). */
export function prochainsCreneaux(
  role: RecipeRole,
  now: Date,
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  max = 4,
): Creneau[] {
  const slot = slotForRole(role);
  if (!slot) return [];
  const todayIdx = (now.getDay() + 6) % 7; // 0 = lundi
  const h = now.getHours();

  // Candidats (dOffset, mealKey) dans l'ordre du temps, filtrés par compatibilité.
  const cands: { d: number; meal: MealKey }[] = [];
  if (role === 'petitdej') {
    for (let d = 0; d < 8 && cands.length < max; d++) {
      if (d === 0 && h >= 9) continue; // le matin d'aujourd'hui est passé
      cands.push({ d, meal: 'petitdej' });
    }
  } else {
    for (let d = 0; d < 8 && cands.length < max; d++) {
      if (d > 0 || h < 11) cands.push({ d, meal: 'dej' });
      if (cands.length >= max) break;
      if (d > 0 || h < 18) cands.push({ d, meal: 'diner' });
    }
  }

  return cands.slice(0, max).map(({ d, meal }) => {
    const idx = todayIdx + d;
    const dayKey = config.jours[idx % 7].key;
    const weekDelta = (idx > 6 ? 1 : 0) as 0 | 1;
    let remplace: string | undefined;
    if (weekDelta === 0) {
      const m = week.days[dayKey]?.[meal];
      const enPlace = slot === 'acc' ? m?.acc?.id : slot === 'entree' ? m?.entree : m?.plat;
      if (enPlace) remplace = byId.get(enPlace)?.nom ?? 'un composant';
    }
    return { dayKey, mealKey: meal, weekDelta, slot, dOffset: d, remplace };
  });
}
