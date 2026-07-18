import { describe, expect, it } from 'vitest';
import { pickable } from './picker';
import type { Recipe, RecipeRole } from '../types';

// ── Verrou G2 (retour Q&A, GO T5) — moitié « picker » ────────────────────────
// « Une recette Test n'est JAMAIS listée par le sélecteur de composant. »
// L'enum de statut ('Validé'/'Test'/'Écarté') est PARTAGÉ avec le domaine
// Sécurité : un futur travail là-bas ne doit pas pouvoir casser G2 en silence —
// d'où cette porte unitaire sur la règle pure, indépendante du JSX.

const rec = (id: string, role: RecipeRole, statut: Recipe['statut']): Recipe => ({
  id,
  nom: id,
  role,
  statut,
  ingredients: 'x',
});

describe('lib/picker — verrou G2 : Test jamais proposé au menu', () => {
  it('une recette Test du BON rôle n’est pas listée ; Écarté non plus', () => {
    const rs = [rec('ok', 'plat', 'Validé'), rec('draft', 'plat', 'Test'), rec('out', 'plat', 'Écarté')];
    expect(pickable(rs, 'plat').map((r) => r.id)).toEqual(['ok']);
  });

  it('vrai pour TOUS les rôles de créneau (petitdej / entree / plat / acc)', () => {
    for (const role of ['petitdej', 'entree', 'plat', 'acc'] as RecipeRole[]) {
      const rs = [rec('v', role, 'Validé'), rec('t', role, 'Test')];
      expect(pickable(rs, role).map((r) => r.id)).toEqual(['v']);
    }
  });
});

describe('lib/picker — F5.2 : moments et créneaux (décision PO Q2)', () => {
  it('la soupe est éligible comme ENTRÉE et comme PLAT — mais Validé seulement', () => {
    const rs = [rec('soupe-ok', 'soupe', 'Validé'), rec('soupe-draft', 'soupe', 'Test')];
    expect(pickable(rs, 'entree').map((r) => r.id)).toEqual(['soupe-ok']);
    expect(pickable(rs, 'plat').map((r) => r.id)).toEqual(['soupe-ok']);
    expect(pickable(rs, 'petitdej')).toEqual([]);
    expect(pickable(rs, 'acc')).toEqual([]);
  });

  it('dessert / goûter / boisson : jamais de créneau en v1 (bibliothèque seulement)', () => {
    const rs = [rec('d', 'dessert', 'Validé'), rec('g', 'gouter', 'Validé'), rec('b', 'boisson', 'Validé')];
    for (const role of ['petitdej', 'entree', 'plat', 'acc'] as RecipeRole[]) {
      expect(pickable(rs, role)).toEqual([]);
    }
  });
});
