import { describe, expect, it } from 'vitest';
import { alerteRegles } from './guard.ts';

// Prompt v2 T2b — le garde G3 LEXICAL serveur : rend G3 vrai, pas déclaratif.
// (Runnable en Vitest car `guard.ts` est un module PUR — l'edge Deno l'importe aussi.)

describe('alerteRegles — garde G3 lexical (serveur)', () => {
  it('interdit présent dans les ingrédients malgré la règle → alerte', () => {
    const a = alerteRegles(['arachide'], 'poulet 200 g · pâte d’arachide 50 g');
    expect(a).toHaveLength(1);
    expect(a[0]).toContain('arachide');
  });

  it('normalise casse et accents (comme matchAllergenes)', () => {
    expect(alerteRegles(['Arachide'], 'PÂTE D’ARACHIDE')).toHaveLength(1);
    expect(alerteRegles(['sésame'], 'graines de SESAME grillées')).toHaveLength(1);
  });

  it('interdit ABSENT → aucune alerte (le cas normal)', () => {
    expect(alerteRegles(['arachide', 'gluten'], 'poulet · riz · courgette')).toEqual([]);
  });

  it('halal N’EST PAS couvert par le garde lexical (option a — concept composé)', () => {
    // « halal » ne doit jamais produire d'alerte lexicale, même si le mot apparaît.
    expect(alerteRegles(['halal'], 'viande halal · riz')).toEqual([]);
  });

  it('entrées trop courtes (< 3 lettres) ignorées (bruit)', () => {
    expect(alerteRegles(['ma'], 'tomate · macaroni')).toEqual([]);
  });

  it('plusieurs interdits → une alerte par match', () => {
    const a = alerteRegles(['arachide', 'gluten', 'porc'], 'pâte d’arachide · farine de gluten · poulet');
    expect(a).toHaveLength(2); // arachide + gluten ; porc absent
  });

  it('limite assumée : « gluten » ne matche pas « farine de blé » (synonymes non couverts)', () => {
    expect(alerteRegles(['gluten'], 'farine de blé · levure')).toEqual([]);
  });
});
