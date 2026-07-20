import { beforeEach, describe, expect, it, vi } from 'vitest';

// Retours device PO (lot UI) n°2/n°3 — les invariants de la SUPPRESSION réelle :
// ① deleteRecipe purge les créneaux de la semaine COURANTE qui la référencent
//   (jamais de créneau fantôme à l'écran) ;
// ② copyDayInto FILTRE les ids orphelins (recette supprimée depuis) — une
//   archive qui référence une recette morte ne recrée pas de fantôme à la copie.

vi.mock('../lib/db', () => ({
  saveRecipe: vi.fn(),
  deleteRecipeDb: vi.fn(),
  saveWeek: vi.fn(),
}));

import { useStore } from './useStore';
import type { DayMenu, Recipe } from '../types';

const r = (id: string, nom: string): Recipe => ({ id, nom, role: 'plat', statut: 'Validé', ingredients: 'x 1' });

const day = (over: Partial<DayMenu> = {}): DayMenu => ({
  petitdej: { plat: null },
  dej: { plat: null, entree: null, acc: null },
  gouter: { plat: null },
  diner: { plat: null, entree: null, acc: null },
  ...over,
});

beforeEach(() => {
  useStore.setState({
    recipes: [r('p1', 'Tajine'), r('p2', 'Couscous'), r('e1', 'Salade')],
    week: {
      id: 'current',
      days: {
        lun: day({ dej: { plat: 'p1', entree: 'e1', acc: { id: 'p2', g: 100 } } }),
        mar: day({ gouter: { plat: 'p1' } }),
      },
    },
  });
});

describe('deleteRecipe — purge de la semaine courante', () => {
  it('vide TOUS les créneaux qui référencent la recette (plat, goûter)', () => {
    useStore.getState().deleteRecipe('p1');
    const { recipes, week } = useStore.getState();
    expect(recipes.map((x) => x.id)).toEqual(['p2', 'e1']);
    expect(week.days.lun.dej.plat).toBeNull();
    expect(week.days.mar.gouter?.plat).toBeNull();
    // les autres composants du repas survivent (entrée seule = repas légal, n°3)
    expect(week.days.lun.dej.entree).toBe('e1');
    expect(week.days.lun.dej.acc?.id).toBe('p2');
  });

  it('purge aussi les slots entrée et accompagnement', () => {
    useStore.getState().deleteRecipe('e1');
    expect(useStore.getState().week.days.lun.dej.entree).toBeNull();
    useStore.getState().deleteRecipe('p2');
    expect(useStore.getState().week.days.lun.dej.acc).toBeNull();
  });
});

describe('copyDayInto — filtre des orphelins', () => {
  it('un jour archivé référençant une recette SUPPRIMÉE se copie sans fantôme', () => {
    const archive = day({ dej: { plat: 'MORTE', entree: 'e1', acc: { id: 'DISPARUE', g: 50 } } });
    useStore.getState().copyDayInto('mar', archive);
    const mar = useStore.getState().week.days.mar;
    expect(mar.dej.plat).toBeNull(); // l'id inconnu est filtré
    expect(mar.dej.entree).toBe('e1'); // l'id vivant survit
    expect(mar.dej.acc).toBeNull();
  });
});
