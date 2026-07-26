import { describe, it, expect } from 'vitest';
import { varianteSuppression, dependants } from './suppression';
import type { FoyerInfo } from '../lib/auth';

const base: FoyerInfo = {
  foyerId: 'f1',
  jeSuisFondateur: true,
  prenomFondateur: 'Amine',
  membres: [{ userId: 'u1', prenom: 'Amine', moi: true }],
  nbEspaces: 0,
};

describe('varianteSuppression (T4)', () => {
  it('fondateur seul, sans page partagée → aucune conséquence à brandir', () => {
    expect(varianteSuppression(base)).toBe('seul');
    expect(dependants(base)).toEqual([]);
  });

  it('fondateur avec un autre membre → variante fondateur, le membre est nommé', () => {
    const info = { ...base, membres: [...base.membres, { userId: 'u2', prenom: 'Sofia', moi: false }] };
    expect(varianteSuppression(info)).toBe('fondateur');
    expect(dependants(info)).toEqual(['Sofia perd l’accès au foyer']);
  });

  it('fondateur SEUL mais avec des pages partagées → variante fondateur (le personnel est coupé)', () => {
    const info = { ...base, nbEspaces: 3 };
    expect(varianteSuppression(info)).toBe('fondateur');
    expect(dependants(info)).toEqual(['3 pages partagées cessent de fonctionner']);
  });

  it('une seule page partagée → singulier', () => {
    expect(dependants({ ...base, nbEspaces: 1 })).toEqual(['1 page partagée cesse de fonctionner']);
  });

  it('membre → le foyer survit, quel que soit le nombre de pages', () => {
    const info: FoyerInfo = {
      ...base,
      jeSuisFondateur: false,
      nbEspaces: 5,
      membres: [
        { userId: 'u1', prenom: 'Amine', moi: false },
        { userId: 'u2', prenom: 'Sofia', moi: true },
      ],
    };
    expect(varianteSuppression(info)).toBe('membre');
  });

  it('un membre sans prénom reste nommable (jamais de ligne vide)', () => {
    const info = { ...base, membres: [...base.membres, { userId: 'u2', prenom: null, moi: false }] };
    expect(dependants(info)).toEqual(['Un autre membre perd l’accès au foyer']);
  });

  it('foyer illisible (hors-ligne) → « inconnu », et AUCUN dépendant inventé', () => {
    expect(varianteSuppression(null)).toBe('inconnu');
    expect(dependants(null)).toEqual([]);
  });
});
