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

describe('buildShoppingList (modèle v2)', () => {
  const byId = new Map<string, Recipe>(SEED_RECIPES.map((r) => [r.id, r]));
  const mk = (plat: string, acc?: { id: string; g: number }): WeekMenu => ({
    id: 't',
    days: {
      lun: {
        petitdej: { plat: null },
        dej: { plat, entree: null, acc: acc ?? null },
        diner: { plat: null, entree: null, acc: null },
      },
    },
  });

  it('agrège les ingrédients du plat (riz présent)', () => {
    const groups = buildShoppingList(SEED_CONFIG, mk('DEJ-04'), byId);
    const riz = groups.find((g) => g.id === 'epicerie')?.lines.find((l) => l.name === 'Riz');
    expect(riz?.unit).toBe('g');
    expect(riz?.qty).toBe(150); // DEJ-04 riz 150g, 1 personne
  });

  it('met à l’échelle ×personnes', () => {
    const base = buildShoppingList(SEED_CONFIG, mk('DEJ-04'), byId);
    const x4 = buildShoppingList(SEED_CONFIG, mk('DEJ-04'), byId, 4);
    const rizB = base.find((g) => g.id === 'epicerie')?.lines.find((l) => l.name === 'Riz');
    const rizX4 = x4.find((g) => g.id === 'epicerie')?.lines.find((l) => l.name === 'Riz');
    expect(rizX4?.qty).toBe((rizB!.qty as number) * 4);
  });

  it('inclut l’accompagnement (quantité g ×personnes)', () => {
    const groups = buildShoppingList(SEED_CONFIG, mk('DEJ-04', { id: 'ACC-01', g: 100 }), byId, 3);
    const allLines = groups.flatMap((g) => g.lines);
    const acc = allLines.find((l) => /riz blanc/i.test(l.name));
    expect(acc?.qty).toBe(300); // 100 g × 3 personnes
  });

  it('ignore les jours vides', () => {
    expect(buildShoppingList(SEED_CONFIG, { id: 't', days: {} }, byId)).toHaveLength(0);
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
