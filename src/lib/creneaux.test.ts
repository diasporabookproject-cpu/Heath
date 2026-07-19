import { describe, expect, it } from 'vitest';
import { prochainsCreneaux, slotForRole } from './creneaux';
import type { AppConfig, Recipe, WeekMenu } from '../types';

// F6.1 — la règle « prochain repas à venir », Q3 AMENDÉE : compatible avec le
// moment de la recette, JAMAIS un plat posé au Matin.

const CONFIG: AppConfig = {
  jours: [
    { key: 'lun', nom: 'Lundi' },
    { key: 'mar', nom: 'Mardi' },
    { key: 'mer', nom: 'Mercredi' },
    { key: 'jeu', nom: 'Jeudi' },
    { key: 'ven', nom: 'Vendredi' },
    { key: 'sam', nom: 'Samedi' },
    { key: 'dim', nom: 'Dimanche' },
  ],
};

const emptyMeal = () => ({ plat: null, entree: null, acc: null });
const emptyWeek = (): WeekMenu => ({
  id: 'w',
  days: Object.fromEntries(
    CONFIG.jours.map((j) => [j.key, { petitdej: emptyMeal(), dej: emptyMeal(), diner: emptyMeal() }]),
  ),
});

// mercredi 15 juillet 2026 (getDay()=3 → idx lundi-based = 2 = 'mer')
const mercredi = (h: number) => new Date(2026, 6, 15, h, 0, 0);
const dimanche = (h: number) => new Date(2026, 6, 19, h, 0, 0);

describe('lib/creneaux — défaut = prochain repas COMPATIBLE (Q3 amendée)', () => {
  const week = emptyWeek();
  const byId = new Map<string, Recipe>();

  it('plat avant 11 h → Midi aujourd’hui', () => {
    const [c] = prochainsCreneaux('plat', mercredi(9), CONFIG, week, byId);
    expect(c).toMatchObject({ dayKey: 'mer', mealKey: 'dej', dOffset: 0, weekDelta: 0, slot: 'plat' });
  });

  it('plat entre 11 h et 18 h → Soir aujourd’hui', () => {
    const [c] = prochainsCreneaux('plat', mercredi(12), CONFIG, week, byId);
    expect(c).toMatchObject({ dayKey: 'mer', mealKey: 'diner', dOffset: 0 });
  });

  it('plat après 18 h → MIDI demain (amendement : jamais un plat au Matin)', () => {
    const [c] = prochainsCreneaux('plat', mercredi(20), CONFIG, week, byId);
    expect(c).toMatchObject({ dayKey: 'jeu', mealKey: 'dej', dOffset: 1 });
    // et AUCUN candidat petitdej, jamais :
    for (const k of prochainsCreneaux('plat', mercredi(20), CONFIG, week, byId)) {
      expect(k.mealKey).not.toBe('petitdej');
    }
  });

  it('petit-déj → prochain MATIN (aujourd’hui avant 9 h, sinon demain) — jamais Midi/Soir', () => {
    expect(prochainsCreneaux('petitdej', mercredi(7), CONFIG, week, byId)[0]).toMatchObject({
      dayKey: 'mer',
      mealKey: 'petitdej',
      dOffset: 0,
    });
    expect(prochainsCreneaux('petitdej', mercredi(10), CONFIG, week, byId)[0]).toMatchObject({
      dayKey: 'jeu',
      dOffset: 1,
    });
    for (const k of prochainsCreneaux('petitdej', mercredi(10), CONFIG, week, byId)) {
      expect(k.mealKey).toBe('petitdej');
    }
  });

  it('dimanche soir → lundi de la SEMAINE SUIVANTE (weekDelta 1)', () => {
    const [c] = prochainsCreneaux('plat', dimanche(20), CONFIG, week, byId);
    expect(c).toMatchObject({ dayKey: 'lun', mealKey: 'dej', weekDelta: 1, dOffset: 1 });
  });

  it('entrée → slot entree · soupe → slot plat · accompagnement → slot acc', () => {
    expect(prochainsCreneaux('entree', mercredi(9), CONFIG, week, byId)[0].slot).toBe('entree');
    expect(prochainsCreneaux('soupe', mercredi(9), CONFIG, week, byId)[0].slot).toBe('plat');
    expect(prochainsCreneaux('acc', mercredi(9), CONFIG, week, byId)[0].slot).toBe('acc');
  });

  it('créneau occupé → `remplace` porte le NOM du plat en place (montré avant le tap)', () => {
    const week2 = emptyWeek();
    week2.days['mer'].dej.plat = 'PLT-01';
    const byId2 = new Map<string, Recipe>([
      ['PLT-01', { id: 'PLT-01', nom: 'Tajine en place' } as Recipe],
    ]);
    const [c] = prochainsCreneaux('plat', mercredi(9), CONFIG, week2, byId2);
    expect(c.remplace).toBe('Tajine en place');
  });

  it('dessert / boisson : AUCUN créneau — slotForRole null, liste vide', () => {
    for (const r of ['dessert', 'boisson'] as const) {
      expect(slotForRole(r)).toBeNull();
      expect(prochainsCreneaux(r, mercredi(9), CONFIG, emptyWeek(), byId)).toEqual([]);
    }
  });

  // T3 (lot UI) : le goûter est un moment PLEIN — il a gagné son créneau
  // (plat seul, ruling PO). L'ancienne règle Q2 v1 le classait « sans créneau ».
  it('goûter (T3) : créneau PLEIN — prochain goûter, jamais un autre moment', () => {
    expect(slotForRole('gouter')).toBe('plat');
    const avant = prochainsCreneaux('gouter', mercredi(9), CONFIG, emptyWeek(), byId);
    expect(avant[0]).toMatchObject({ mealKey: 'gouter', dOffset: 0 }); // 9 h → goûter du jour
    const apres = prochainsCreneaux('gouter', mercredi(18), CONFIG, emptyWeek(), byId);
    expect(apres[0]).toMatchObject({ mealKey: 'gouter', dOffset: 1 }); // 18 h → demain
    expect(apres.every((c) => c.mealKey === 'gouter')).toBe(true);
  });
});
