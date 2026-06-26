import { describe, expect, it } from 'vitest';
import {
  assessDay,
  dayTotals,
  feuCalcium,
  feuKcal,
  feuProteines,
  kcalStatusWord,
  weekAverages,
} from './nutrition';
import { SEED_CONFIG, SEED_RECIPES } from '../data';
import type { Recipe } from '../types';

const byId = new Map<string, Recipe>(SEED_RECIPES.map((r) => [r.id, r]));
const cibles = SEED_CONFIG.cibles;

describe('éléments fixes toujours comptés', () => {
  it('une journée vide vaut collation + kéfir', () => {
    const totals = dayTotals({ dejId: null, dinId: null, extras: [] }, byId, SEED_CONFIG);
    // collation 195 + kéfir 135 = 330 kcal ; calcium 275 + 325 = 600
    expect(totals.kcal).toBe(330);
    expect(totals.calcium).toBe(600);
    expect(totals.prot).toBe(19);
  });
});

describe('feux tricolores', () => {
  it('kcal : ±10% vert, ±20% orange, au-delà rouge', () => {
    expect(feuKcal(1720, 1720, cibles)).toBe('vert');
    expect(feuKcal(1720 * 1.1, 1720, cibles)).toBe('vert');
    expect(feuKcal(1720 * 1.15, 1720, cibles)).toBe('orange');
    expect(feuKcal(1720 * 1.25, 1720, cibles)).toBe('rouge');
    expect(feuKcal(1720 * 0.75, 1720, cibles)).toBe('rouge');
  });

  it('protéines : ≥150 vert · 130–150 orange · <130 rouge', () => {
    expect(feuProteines(150, cibles)).toBe('vert');
    expect(feuProteines(140, cibles)).toBe('orange');
    expect(feuProteines(129, cibles)).toBe('rouge');
  });

  it('calcium : ≥1000 vert · 850–1000 orange · <850 rouge', () => {
    expect(feuCalcium(1000, cibles)).toBe('vert');
    expect(feuCalcium(900, cibles)).toBe('orange');
    expect(feuCalcium(849, cibles)).toBe('rouge');
  });
});

describe('kcalStatusWord (jauge Semaine)', () => {
  it('dans la cible à ±10 %', () => {
    expect(kcalStatusWord(1720, 1720, cibles)).toEqual({ cls: 'ok', word: 'dans la cible' });
    expect(kcalStatusWord(1720 * 1.1, 1720, cibles).cls).toBe('ok');
  });
  it('un peu haut / un peu bas entre ±10 et ±20 %', () => {
    expect(kcalStatusWord(1720 * 1.15, 1720, cibles)).toEqual({ cls: 'warn', word: 'un peu haut' });
    expect(kcalStatusWord(1720 * 0.85, 1720, cibles)).toEqual({ cls: 'warn', word: 'un peu bas' });
  });
  it('au-dessus / en dessous au-delà de ±20 %', () => {
    expect(kcalStatusWord(1720 * 1.25, 1720, cibles)).toEqual({ cls: 'bad', word: 'au-dessus' });
    expect(kcalStatusWord(1720 * 0.7, 1720, cibles)).toEqual({ cls: 'bad', word: 'en dessous' });
  });
});

describe('assessDay utilise la cible selon le type de jour', () => {
  it('un jour Muscu vise 1950 kcal', () => {
    const jourMuscu = SEED_CONFIG.jours.find((j) => j.type === 'Muscu')!;
    const a = assessDay(jourMuscu, { dejId: null, dinId: null, extras: [] }, byId, SEED_CONFIG);
    expect(a.cibleKcal).toBe(1950);
  });
});

describe('extras comptés (ex. Creami)', () => {
  it("ajoute les macros de l'extra", () => {
    const sans = dayTotals({ dejId: 'DEJ-01', dinId: 'DIN-05', extras: [] }, byId, SEED_CONFIG);
    const avec = dayTotals(
      { dejId: 'DEJ-01', dinId: 'DIN-05', extras: ['CF-03'] },
      byId,
      SEED_CONFIG,
    );
    expect(avec.kcal - sans.kcal).toBe(SEED_RECIPES.find((r) => r.id === 'CF-03')!.kcal);
  });
});

describe('moyenne semaine', () => {
  it('moyenne une semaine vide = éléments fixes par jour', () => {
    const avg = weekAverages(SEED_CONFIG, {}, byId);
    expect(avg.perDay.kcal).toBe(330);
    expect(avg.perDay.calcium).toBe(600);
  });
});
