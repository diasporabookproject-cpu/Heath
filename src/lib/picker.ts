import type { Recipe, RecipeRole } from '../types';

/**
 * T5 — règle d'éligibilité du sélecteur de composant, EXTRAITE en fonction pure
 * (retour Q&A du readout T4) : G2 repose sur « une recette `Test` n'entre jamais
 * dans un menu » — cette règle est désormais testée unitairement (picker.test.ts)
 * au lieu de vivre implicitement dans le JSX du RecipePickerSheet.
 *
 * F5.2 (décision PO Q2) : la SOUPE est éligible comme entrée ET comme plat ;
 * dessert / goûter / boisson n'ont pas de créneau en v1 (bibliothèque + fiche
 * seulement) — ils ne sont donc JAMAIS renvoyés ici.
 */
export function pickable(recipes: Recipe[], role: RecipeRole): Recipe[] {
  return recipes.filter(
    (r) =>
      r.statut === 'Validé' && // G2 : les brouillons n'atteignent JAMAIS un menu
      (r.role === role || (r.role === 'soupe' && (role === 'entree' || role === 'plat'))),
  );
}
