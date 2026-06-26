import type { Recipe, RecipeType } from '../types';

const PREFIX: Record<RecipeType, string> = {
  Déjeuner: 'DEJ',
  Dîner: 'DIN',
  'Coupe-faim': 'CF',
};

/** Prochain identifiant libre pour un type (DEJ-01, DIN-02, CF-03…). */
export function nextRecipeId(recipes: Recipe[], type: RecipeType): string {
  const prefix = PREFIX[type];
  let max = 0;
  for (const r of recipes) {
    const m = r.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}
