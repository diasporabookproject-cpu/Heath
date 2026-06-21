import { describe, expect, it } from 'vitest';
import { deriveFlag, parseRecipesJson } from './importRecipes';
import type { Recipe } from '../types';

const existing: Recipe[] = [
  { id: 'DEJ-01', nom: 'X', type: 'Déjeuner', statut: 'Validé', jour: 'Tous', kcal: 1, prot: 1, gluc: 1, lip: 1, calcium: 1, flag_calcium: 'Faible', ingredients: '' },
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
      { nom: 'Bowl test', type: 'Déjeuner', kcal: 700, prot: 60, calcium: 400, ingredients: 'riz 100g' },
    ]);
    const { recipes, errors } = parseRecipesJson(json, existing);
    expect(errors).toEqual([]);
    expect(recipes[0].id).toBe('DEJ-02'); // DEJ-01 déjà pris
    expect(recipes[0].flag_calcium).toBe('Champion'); // dérivé de 400
    expect(recipes[0].statut).toBe('Validé');
  });

  it('accepte un objet seul et { recettes: [...] }', () => {
    expect(parseRecipesJson('{"nom":"A","type":"Dîner"}', []).recipes).toHaveLength(1);
    expect(
      parseRecipesJson('{"recettes":[{"nom":"A","type":"Coupe-faim"}]}', []).recipes,
    ).toHaveLength(1);
  });

  it('remonte des erreurs lisibles', () => {
    const { recipes, errors } = parseRecipesJson('[{"type":"Déjeuner"},{"nom":"B","type":"x"}]', []);
    expect(recipes).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it('signale un JSON invalide', () => {
    expect(parseRecipesJson('pas du json', []).errors[0]).toMatch(/JSON invalide/);
  });

  it('conserve les champs darija', () => {
    const json = '[{"nom":"A","type":"Dîner","nom_ar":"أ","ingredients_ar":"مكونات"}]';
    const r = parseRecipesJson(json, []).recipes[0];
    expect(r.nom_ar).toBe('أ');
    expect(r.ingredients_ar).toBe('مكونات');
  });
});
