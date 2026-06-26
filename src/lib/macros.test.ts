import { describe, expect, it } from 'vitest';
import { estimateMacrosLocal, calciumFlag } from './macros';

describe('calciumFlag', () => {
  it('Champion ≥300, Moyen ≥150, sinon Faible', () => {
    expect(calciumFlag(300)).toBe('Champion');
    expect(calciumFlag(200)).toBe('Moyen');
    expect(calciumFlag(149)).toBe('Faible');
  });
});

describe('estimateMacrosLocal', () => {
  it('reconnaît les ingrédients et somme les macros (g)', () => {
    const m = estimateMacrosLocal('Poulet cuit 200g · riz cuit 100g · feta 40g');
    // poulet 200g: 330 kcal / 62 P ; riz 100g: 130 / 2.7 ; feta 40g: ~106 / 5.6
    expect(m.kcal).toBeGreaterThan(500);
    expect(m.prot).toBeGreaterThan(60);
    // feta apporte ~197 mg de calcium
    expect(m.calcium).toBeGreaterThan(180);
    expect(m.matched).toBe(3);
    expect(m.total).toBe(3);
  });

  it('calcium champion détecté via laitages/graines', () => {
    const m = estimateMacrosLocal('yaourt 200g · amandes 30g · tahini 1 càs');
    expect(m.calcium).toBeGreaterThanOrEqual(300);
    expect(m.flag_calcium).toBe('Champion');
  });

  it('gère càc/càs et segments non reconnus', () => {
    const m = estimateMacrosLocal('huile 1 càc · ingrédient inconnu xyz');
    expect(m.matched).toBe(1); // seul "huile" reconnu
    expect(m.total).toBe(2);
    expect(m.kcal).toBeGreaterThan(0); // 1 càc huile ≈ 5g
  });
});
