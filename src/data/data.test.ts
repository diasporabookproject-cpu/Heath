import { describe, expect, it } from 'vitest';
import { SEED_RECIPES } from './index';

describe('jeu de données', () => {
  it('toutes les recettes ont une traduction darija (nom + ingrédients)', () => {
    const manquantes = SEED_RECIPES.filter((r) => !r.nom_ar || !r.ingredients_ar).map((r) => r.id);
    expect(manquantes).toEqual([]);
  });

  it('les noms darija sont en lettres arabes', () => {
    const arabic = /[؀-ۿ]/;
    for (const r of SEED_RECIPES) {
      expect(arabic.test(r.nom_ar ?? '')).toBe(true);
    }
  });
});
