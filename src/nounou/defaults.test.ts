import { describe, expect, it } from 'vitest';
import { CONDUITE_MODELES, missingConduiteModeles, seedNounouDoc } from './defaults';

// F1/F3 (Flow FTUE) : plus de seed personnel ; gabarits installables et idempotents.

describe('nounou — seed & gabarits', () => {
  it('F1 : seedNounouDoc est VIDE de tout personnel (numéros Maroc conservés)', () => {
    const doc = seedNounouDoc();
    expect(doc.enfants).toEqual([]);
    expect(doc.rythme).toEqual([]);
    expect(doc.conduites).toEqual([]);
    expect(doc.destinataires).toEqual([]);
    // info pays générique — reste (portée par emptyNounouDoc)
    expect(doc.urgence.numeros.length).toBeGreaterThan(0);
    expect(doc.urgence.numeros.every((n) => n.aVerifier)).toBe(true);
  });

  it('F3 : missingConduiteModeles — tout sur un doc vide, rien après installation', () => {
    expect(missingConduiteModeles([]).length).toBe(CONDUITE_MODELES.length); // 6
    const installed = CONDUITE_MODELES.map((m) => ({ titre: m.titre }));
    expect(missingConduiteModeles(installed)).toEqual([]);
  });

  it('F3 : anti-doublon insensible à la casse et aux espaces', () => {
    const existing = [{ titre: '  fièvre ' }, { titre: 'ÉTOUFFEMENT' }];
    const missing = missingConduiteModeles(existing).map((m) => m.titre);
    expect(missing).not.toContain('Fièvre');
    expect(missing).not.toContain('Étouffement');
    expect(missing.length).toBe(CONDUITE_MODELES.length - 2);
  });
});
