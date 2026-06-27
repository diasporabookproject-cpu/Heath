import { describe, expect, it } from 'vitest';
import { deriveFlag, parseRecipesJson } from './importRecipes';
import type { Recipe } from '../types';

const existing: Recipe[] = [
  { id: 'PLT-01', nom: 'X', role: 'plat', statut: 'Validé', kcal: 1, prot: 1, gluc: 1, lip: 1, calcium: 1, flag_calcium: 'Faible', ingredients: '' },
];

describe('deriveFlag', () => {
  it('seuils Champion/Moyen/Faible', () => {
    expect(deriveFlag(400)).toBe('Champion');
    expect(deriveFlag(250)).toBe('Moyen');
    expect(deriveFlag(100)).toBe('Faible');
  });
});

describe('parseRecipesJson', () => {
  it('importe un tableau et génère un id sans collision', () => {
    const json = JSON.stringify([
      { nom: 'Bowl test', role: 'plat', kcal: 700, prot: 60, calcium: 400, ingredients: 'riz 100g' },
    ]);
    const { recipes, errors } = parseRecipesJson(json, existing);
    expect(errors).toEqual([]);
    expect(recipes[0].id).toBe('PLT-02'); // PLT-01 déjà pris
    expect(recipes[0].role).toBe('plat');
    expect(recipes[0].flag_calcium).toBe('Champion');
  });

  it('tolère l’ancien "type" et le mappe au rôle', () => {
    expect(parseRecipesJson('{"nom":"A","type":"Coupe-faim"}', []).recipes[0].role).toBe('entree');
    expect(parseRecipesJson('{"nom":"A","type":"Dîner"}', []).recipes[0].role).toBe('plat');
  });

  it('déduit le rôle par défaut (plat) et n’échoue que sur le nom manquant', () => {
    const { recipes, errors } = parseRecipesJson('[{"role":"plat"},{"nom":"B"}]', []);
    expect(recipes).toHaveLength(1); // 2e importée (rôle plat par défaut)
    expect(errors).toHaveLength(1); // 1re sans nom
  });

  it('signale un JSON invalide', () => {
    expect(parseRecipesJson('pas du json', []).errors[0]).toMatch(/JSON invalide/);
  });

  it('conserve les champs darija et les étapes', () => {
    const json = '[{"nom":"A","role":"plat","nom_ar":"أ","ingredients_ar":"مكونات","etapes_ar":"خطوة"}]';
    const r = parseRecipesJson(json, []).recipes[0];
    expect(r.nom_ar).toBe('أ');
    expect(r.ingredients_ar).toBe('مكونات');
    expect(r.etapes_ar).toBe('خطوة');
  });
});
