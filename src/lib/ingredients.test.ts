import { describe, expect, it } from 'vitest';
import { splitIngredients, splitSteps, scaleQty, scaledRows } from './ingredients';

describe('splitIngredients', () => {
  it('sépare nom / quantité', () => {
    const rows = splitIngredients('Poulet cuit 200g · riz cuit 110g · huile 1 càc');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ name: 'Poulet cuit', qty: '200g' });
    expect(rows[2]).toEqual({ name: 'huile', qty: '1 càc' });
  });
  it('gère un segment sans quantité', () => {
    const rows = splitIngredients('sel et poivre');
    expect(rows[0]).toEqual({ name: 'sel et poivre', qty: '' });
  });
});

describe('scaleQty', () => {
  it('multiplie la première quantité', () => {
    expect(scaleQty('200g', 4)).toBe('800g');
    expect(scaleQty('1 càc', 4)).toBe('4 càc');
    expect(scaleQty('', 4)).toBe('');
  });
  it('facteur 1 = inchangé', () => {
    expect(scaleQty('200g', 1)).toBe('200g');
  });
});

describe('scaledRows', () => {
  it('met à l’échelle pour N personnes (1 portion → N)', () => {
    const rows = scaledRows('Poulet 200g · feta 40g', 4);
    expect(rows[0].qty).toBe('800g');
    expect(rows[1].qty).toBe('160g');
  });
});

describe('splitSteps', () => {
  it('découpe par ligne et retire la numérotation', () => {
    expect(splitSteps('1. Couper\n2) Cuire\nDresser')).toEqual(['Couper', 'Cuire', 'Dresser']);
    expect(splitSteps(undefined)).toEqual([]);
  });
});
