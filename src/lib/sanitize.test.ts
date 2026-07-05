import { describe, expect, it } from 'vitest';
import { cleanText, cleanQty, phoneNbsp } from './sanitize';

const nb = (s: string) => s.replace(/ /g, ' '); // normalise nbsp pour comparer

describe('cleanText', () => {
  it('retire le markdown', () => {
    expect(cleanText('**Kefta** de bœuf')).toBe('Kefta de bœuf');
    expect(cleanText('_Harira_ `traditionnelle`')).toBe('Harira traditionnelle');
    expect(cleanText('## Titre')).toBe('Titre');
  });
  it('retire les emojis parasites', () => {
    expect(cleanText('🐟 Sardines')).toBe('Sardines');
    expect(cleanText('Tajine 🍲')).toBe('Tajine');
    expect(cleanText('🥗 Salade ✨')).toBe('Salade');
  });
  it('normalise espaces et séparateurs', () => {
    expect(cleanText('Riz   cuit')).toBe('Riz cuit');
    expect(cleanText('· Sardines ·')).toBe('Sardines');
    expect(cleanText('Riz · · légumes')).toBe('Riz · légumes');
  });
  it('préserve les lettres arabes', () => {
    expect(cleanText('**المدرسة**')).toBe('المدرسة');
  });
  it('gère vide / null', () => {
    expect(cleanText('')).toBe('');
    expect(cleanText(undefined)).toBe('');
  });
});

describe('cleanQty', () => {
  it('attache le nombre à son unité (insécable)', () => {
    expect(nb(cleanQty('800g'))).toBe('800 g');
    expect(nb(cleanQty('1,5  kg'))).toBe('1,5 kg');
    expect(nb(cleanQty('200 g'))).toBe('200 g');
  });
  it('n’insère pas de double espace', () => {
    expect(cleanQty('800  g')).not.toMatch(/ {2}/);
  });
});

describe('phoneNbsp', () => {
  it('rend le numéro insécable (aucune espace normale)', () => {
    const out = phoneNbsp('06 60 69 96 71');
    expect(out).not.toMatch(/ /); // pas d'espace ASCII
    expect(nb(out)).toBe('06 60 69 96 71');
  });
});
