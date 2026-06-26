import { describe, expect, it } from 'vitest';
import { buildShoppingList, formatQty, parseIngredients, parseItem, rayonFor } from './shopping';
import { SEED_CONFIG, SEED_RECIPES } from '../data';
import type { Recipe, WeekMenu } from '../types';

describe('parseItem', () => {
  it('extrait nom + quantité en grammes', () => {
    expect(parseItem('Poulet cuit 200g')).toMatchObject({ name: 'Poulet', qty: 200, unit: 'g' });
  });

  it('gère les variantes repos/sport en prenant la 1re valeur', () => {
    const it1 = parseItem('riz cuit 110g (repos)/130-150g (sport)');
    expect(it1).toMatchObject({ key: 'riz', qty: 110, unit: 'g' });
  });

  it('compte les pièces et les fractions', () => {
    expect(parseItem('2 œufs durs')).toMatchObject({ key: 'œuf', qty: 2, unit: 'pièce' });
    expect(parseItem('¼ citron confit')).toMatchObject({ qty: 0.25, unit: 'pièce' });
  });

  it('retire le pourcentage et les états de cuisson', () => {
    expect(parseItem('Kefta bœuf 5% 180g cuite')).toMatchObject({ name: 'Kefta bœuf', qty: 180 });
    expect(parseItem('Dorade grillée 220g chair')).toMatchObject({ name: 'Dorade', qty: 220 });
  });
});

describe('parseIngredients', () => {
  it('sépare sur · et sur " + " mais garde les assaisonnements groupés', () => {
    const items = parseIngredients('tomates cerises 60g + concombre 80g · sauce huile+citron+ail');
    const names = items.map((i) => i.name);
    expect(names).toContain('Tomates cerises');
    expect(names).toContain('Concombre');
    // "huile+citron+ail" (sans espaces) reste un seul item
    expect(names.some((n) => n.includes('huile+citron+ail'))).toBe(true);
  });
});

describe('rayonFor', () => {
  it('classe poisson, viande, légume, féculent, condiment', () => {
    expect(rayonFor('saumon').id).toBe('poissonnerie');
    expect(rayonFor('poulet').id).toBe('boucherie');
    expect(rayonFor('courgette').id).toBe('primeur');
    expect(rayonFor('riz').id).toBe('epicerie');
    expect(rayonFor('huile').id).toBe('condiments');
  });
});

describe('buildShoppingList', () => {
  const byId = new Map<string, Recipe>(SEED_RECIPES.map((r) => [r.id, r]));

  it('agrège les grammes des mêmes ingrédients sur la semaine', () => {
    const week: WeekMenu = {
      id: 't',
      days: {
        lun: { dejId: 'DEJ-01', dinId: 'DIN-01', extras: [] }, // riz 110 + …
        mar: { dejId: 'DEJ-04', dinId: 'DIN-05', extras: [] }, // riz 150 + 150
      },
    };
    const groups = buildShoppingList(SEED_CONFIG, week, byId);
    const epicerie = groups.find((g) => g.id === 'epicerie');
    const riz = epicerie?.lines.find((l) => l.name === 'Riz');
    expect(riz?.unit).toBe('g');
    // DEJ-01 110 + DEJ-04 150 + DIN-05 150 = 410 (DIN-01 n'a pas de riz)
    expect(riz?.qty).toBe(410);
  });

  it('ignore les jours vides', () => {
    const groups = buildShoppingList(SEED_CONFIG, { id: 't', days: {} }, byId);
    expect(groups).toHaveLength(0);
  });

  it('met à l’échelle les quantités ×personnes', () => {
    const week: WeekMenu = { id: 't', days: { lun: { dejId: 'DEJ-04', dinId: null, extras: [] } } };
    const base = buildShoppingList(SEED_CONFIG, week, byId);
    const x4 = buildShoppingList(SEED_CONFIG, week, byId, 4);
    const rizBase = base.find((g) => g.id === 'epicerie')?.lines.find((l) => l.name === 'Riz');
    const rizX4 = x4.find((g) => g.id === 'epicerie')?.lines.find((l) => l.name === 'Riz');
    expect(rizBase?.qty).toBeTruthy();
    expect(rizX4?.qty).toBe((rizBase!.qty as number) * 4);
  });
});

describe('formatQty', () => {
  it('passe en kg au-delà de 1000 g', () => {
    expect(formatQty({ name: 'Riz', qty: 1310, unit: 'g', count: 5 })).toBe('1,31 kg');
  });
  it('affiche ×N quand la quantité est inconnue', () => {
    expect(formatQty({ name: 'Coriandre', qty: null, unit: null, count: 3 })).toBe('×3');
  });
});
