import { describe, expect, it } from 'vitest';
import {
  componentMacros,
  mealMacros,
  dayMacros,
  dayComplete,
  objectiveStatus,
  weekAverage,
  emptyDay,
} from './nutrition';
import { SEED_CONFIG, SEED_RECIPES } from '../data';
import type { DayMenu, Recipe } from '../types';

const byId = new Map<string, Recipe>(SEED_RECIPES.map((r) => [r.id, r]));
const plat = SEED_RECIPES.find((r) => r.role === 'plat')!;
const entree = SEED_RECIPES.find((r) => r.role === 'entree')!;
const acc = SEED_RECIPES.find((r) => r.id === 'ACC-01')!; // Riz, 130 kcal/100g

describe('componentMacros', () => {
  it('plat = macros par portion', () => {
    expect(componentMacros('plat', plat.id, byId).kcal).toBe(plat.kcal);
  });
  it('accompagnement = base /100g × quantité', () => {
    expect(componentMacros('acc', { id: acc.id, g: 200 }, byId).kcal).toBe(acc.kcal * 2);
    expect(componentMacros('acc', { id: acc.id, g: 50 }, byId).kcal).toBe(acc.kcal * 0.5);
  });
});

describe('mealMacros / dayMacros', () => {
  it('repas = somme des composants ; petit-déj = plat seul', () => {
    const dej = { plat: plat.id, entree: entree.id, acc: { id: acc.id, g: 100 } };
    expect(mealMacros(dej, 'dej', byId).kcal).toBe(plat.kcal + entree.kcal + acc.kcal);
    // petit-déj ignore entrée/acc
    expect(mealMacros({ plat: plat.id, entree: entree.id }, 'petitdej', byId).kcal).toBe(plat.kcal);
  });
  it('jour = somme des 3 repas', () => {
    const day: DayMenu = {
      petitdej: { plat: plat.id },
      dej: { plat: plat.id, entree: null, acc: null },
      diner: { plat: plat.id, entree: null, acc: null },
    };
    expect(dayMacros(day, byId).kcal).toBe(plat.kcal * 3);
    expect(dayComplete(day)).toBe(true);
    expect(dayComplete(emptyDay())).toBe(false);
  });
});

describe('objectiveStatus (plafond)', () => {
  it('sous / dans / léger dépassement / dépassé', () => {
    expect(objectiveStatus(1500, 1800)).toEqual({ cls: 'ok', word: 'sous l’objectif' });
    expect(objectiveStatus(1750, 1800)).toEqual({ cls: 'ok', word: 'dans l’objectif' });
    expect(objectiveStatus(1900, 1800)).toEqual({ cls: 'warn', word: 'léger dépassement' });
    expect(objectiveStatus(2100, 1800)).toEqual({ cls: 'bad', word: 'objectif dépassé' });
  });
});

describe('weekAverage', () => {
  it('ne moyenne que les jours complets', () => {
    const days: Record<string, DayMenu> = {};
    for (const j of SEED_CONFIG.jours) days[j.key] = emptyDay();
    const full: DayMenu = {
      petitdej: { plat: plat.id },
      dej: { plat: plat.id, entree: null, acc: null },
      diner: { plat: plat.id, entree: null, acc: null },
    };
    days[SEED_CONFIG.jours[0].key] = full;
    const avg = weekAverage(SEED_CONFIG, days, byId);
    expect(avg.count).toBe(1);
    expect(avg.kcal).toBe(plat.kcal * 3);
  });
  it('semaine vide → count 0', () => {
    expect(weekAverage(SEED_CONFIG, {}, byId).count).toBe(0);
  });
});
