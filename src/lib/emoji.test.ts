import { describe, expect, it } from 'vitest';
import { recipeEmoji } from './emoji';

describe('lib/emoji — repère déterministe des cartes (F7.1)', () => {
  it('mot-clé du nom prioritaire (tajine, soupe, poisson…)', () => {
    expect(recipeEmoji({ nom: 'Tagine de poulet', role: 'plat' })).toBe('🍲'); // tajine avant poulet
    expect(recipeEmoji({ nom: 'Soupe de légumes', role: 'entree' })).toBe('🍜');
    expect(recipeEmoji({ nom: 'Dorade rôtie au four', role: 'plat' })).toBe('🐟');
  });

  it('repli par RÔLE quand aucun mot-clé', () => {
    expect(recipeEmoji({ nom: 'Assiette mystère', role: 'plat' })).toBe('🍽️');
    expect(recipeEmoji({ nom: 'Truc du matin', role: 'petitdej' })).toBe('🍳');
    expect(recipeEmoji({ nom: 'Chose sucrée', role: 'gouter' })).toBe('🍪');
  });

  it('déterministe : même nom → même repère, insensible à la casse', () => {
    expect(recipeEmoji({ nom: 'CHAKCHOUKA à la kefta', role: 'plat' })).toBe(
      recipeEmoji({ nom: 'chakchouka à la kefta', role: 'plat' }),
    );
  });
});
