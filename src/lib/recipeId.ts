import type { Recipe, RecipeRole } from '../types';

const PREFIX: Record<RecipeRole, string> = {
  petitdej: 'PDJ',
  entree: 'ENT',
  plat: 'PLT',
  acc: 'ACC',
};

/** Prochain identifiant libre pour un rôle (PLT-01, ENT-02, ACC-03…). */
export function nextRecipeId(recipes: Recipe[], role: RecipeRole): string {
  const prefix = PREFIX[role];
  let max = 0;
  for (const r of recipes) {
    const m = r.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}
