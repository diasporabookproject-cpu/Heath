import { describe, expect, it } from 'vitest';
import { matchAllergenes } from './allergenes';

describe('lib/allergenes — correspondance règles du foyer ↔ recette (F5.5)', () => {
  it('insensible à la casse et aux accents (les deux côtés)', () => {
    expect(matchAllergenes(['Arachide'], 'Poulet aux arachides grillées')).toEqual(['Arachide']);
    expect(matchAllergenes(['sésame'], 'Halva au SESAME')).toEqual(['sésame']);
    expect(matchAllergenes(['crème'], 'sauce a la creme fraiche')).toEqual(['crème']);
  });

  it('cherche dans tout le texte fourni (nom + ingrédients)', () => {
    expect(matchAllergenes(['noix'], 'Tajine · poulet 500 g · noix 30 g')).toEqual(['noix']);
    expect(matchAllergenes(['noix'], 'Tajine simple · poulet 500 g')).toEqual([]);
  });

  it('ignore les termes trop courts (< 3 car.) — anti-bruit', () => {
    expect(matchAllergenes(['ok', ''], 'bouillon ok')).toEqual([]);
  });

  it('plusieurs règles → seules celles qui touchent la recette remontent', () => {
    expect(matchAllergenes(['arachide', 'fruits de mer', 'noix'], 'salade de noix et arachides')).toEqual([
      'arachide',
      'noix',
    ]);
  });
});
