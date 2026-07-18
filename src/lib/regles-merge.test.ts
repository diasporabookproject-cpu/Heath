import { describe, expect, it } from 'vitest';
import { normalizeRegles, reglesList, reglesActives, EMPTY_REGLES, type ReglesFoyer } from '../types';

// Lot simplification — fusion régime + allergies en UN champ `nePasManger`
// (halal reste un toggle). Migration idempotente + le double « sans » disparaît.

describe('normalizeRegles — migration ancien format → nePasManger', () => {
  it('ancien {allergies, halal, regime} → {halal, nePasManger} (regime en tête)', () => {
    expect(normalizeRegles({ allergies: ['arachide'], halal: true, regime: 'végétarien' })).toEqual({
      halal: true,
      nePasManger: ['végétarien', 'arachide'],
    });
  });

  it('regime null / allergies vides → nePasManger vide', () => {
    expect(normalizeRegles({ allergies: [], halal: false, regime: null })).toEqual(EMPTY_REGLES);
  });

  it('nouveau format déjà propre → renvoyé tel quel', () => {
    const n: ReglesFoyer = { halal: false, nePasManger: ['gluten', 'porc'] };
    expect(normalizeRegles(n)).toEqual(n);
  });

  it('idempotente : normaliser deux fois = une fois', () => {
    const once = normalizeRegles({ allergies: ['sésame'], halal: true, regime: null });
    expect(normalizeRegles(once)).toEqual(once);
  });

  it('entrée dégénérée (null / non-objet) → EMPTY', () => {
    expect(normalizeRegles(null)).toEqual(EMPTY_REGLES);
    expect(normalizeRegles('x')).toEqual(EMPTY_REGLES);
  });
});

describe('reglesList — le double « sans » (bug capture prod) a disparu', () => {
  it('« halal · gluten » — les entrées sont brutes, jamais préfixées « sans »', () => {
    expect(reglesList({ halal: true, nePasManger: ['gluten', 'arachide'] })).toEqual([
      'halal',
      'gluten',
      'arachide',
    ]);
  });

  it('reglesActives : vrai dès qu’une restriction est posée', () => {
    expect(reglesActives(EMPTY_REGLES)).toBe(false);
    expect(reglesActives({ halal: true, nePasManger: [] })).toBe(true);
    expect(reglesActives({ halal: false, nePasManger: ['gluten'] })).toBe(true);
  });
});
