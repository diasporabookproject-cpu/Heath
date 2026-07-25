import { describe, expect, it } from 'vitest';
import { pickHeroKey } from './hero';
import type { DayMenu, MealKey } from '../types';

// Refonte T1 — le repas HÉROS = le prochain à servir. Toujours un repas REMPLI
// (jamais un héros vide) ; null seulement si la journée est entièrement vide.

/** Construit une journée où les moments listés portent un plat, les autres vides. */
const day = (...filled: MealKey[]): DayMenu => {
  const has = (k: MealKey) => (filled.includes(k) ? `p-${k}` : null);
  return {
    petitdej: { plat: has('petitdej') },
    dej: { plat: has('dej'), entree: null, acc: null },
    gouter: { plat: has('gouter') },
    diner: { plat: has('diner'), entree: null, acc: null },
  };
};

describe('pickHeroKey — le prochain repas à servir', () => {
  it('journée vide → null (l’appelant montre l’invitation)', () => {
    expect(pickHeroKey(day(), true, '12:00')).toBe(null);
    expect(pickHeroKey(day(), false, '12:00')).toBe(null);
  });

  it('jour futur → premier repas REMPLI dans l’ordre (rien n’est passé)', () => {
    expect(pickHeroKey(day('dej', 'diner'), false, '00:00')).toBe('dej');
    expect(pickHeroKey(day('gouter'), false, '23:59')).toBe('gouter');
  });

  it('aujourd’hui matin → le prochain rempli dont l’heure ≥ maintenant', () => {
    // rempli : déj (12:30) + dîner (20:00) ; à 09:00 le prochain est le déjeuner.
    expect(pickHeroKey(day('dej', 'diner'), true, '09:00')).toBe('dej');
    // à 14:00 le déjeuner est passé → le prochain rempli est le dîner.
    expect(pickHeroKey(day('dej', 'diner'), true, '14:00')).toBe('diner');
  });

  it('aujourd’hui soir, tout passé → le DERNIER rempli (pas de héros vide)', () => {
    expect(pickHeroKey(day('petitdej', 'dej'), true, '22:00')).toBe('dej');
  });

  it('ne promeut jamais un créneau vide même s’il est le prochain par l’heure', () => {
    // seul le petit-déj est rempli ; à 18:00 (goûter/dîner « à venir » mais vides)
    // le héros reste le petit-déj (dernier — et seul — rempli).
    expect(pickHeroKey(day('petitdej'), true, '18:00')).toBe('petitdej');
  });
});
