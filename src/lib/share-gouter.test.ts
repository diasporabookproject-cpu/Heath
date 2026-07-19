import { describe, expect, it } from 'vitest';
import { buildEspaceMenu, usedRecipeIds } from './share';
import type { AppConfig, DayMenu, Recipe, WeekMenu } from '../types';

// T3 (lot UI) — TEST BLOQUANT « sync ancien client » : un `DayMenu` stocké ou
// SYNCHRONISÉ depuis un appareil pas encore à jour n'a PAS la clé `gouter`
// (elle est optionnelle À JAMAIS — pas de migration, tolérance bidirectionnelle).
// Les itérations serveuses du payload ne doivent NI planter NI perdre de données.

const CONFIG: AppConfig = { jours: [{ key: 'lun', nom: 'Lundi' }] };

const recipe = (id: string, nom: string): Recipe => ({
  id,
  nom,
  role: 'plat',
  statut: 'Validé',
  ingredients: 'semoule 300 g',
});

const byId = new Map([
  ['r1', recipe('r1', 'Couscous')],
  ['r2', recipe('r2', 'Cookies aux amandes')],
]);

/** Jour au format PRÉ-T3 (tel que stocké/synchronisé par un ancien client). */
const oldDay = (): DayMenu =>
  ({
    petitdej: { plat: null },
    dej: { plat: 'r1', entree: null, acc: null },
    diner: { plat: null, entree: null, acc: null },
  }) as DayMenu; // volontairement sans `gouter` — c'est le cas testé

const week = (day: DayMenu): WeekMenu => ({ id: 'current', days: { lun: day } });

describe('sync ancien client — DayMenu sans clé gouter', () => {
  it('usedRecipeIds ne plante pas et collecte les recettes présentes', () => {
    expect(usedRecipeIds(CONFIG, week(oldDay()))).toEqual(['r1']);
  });

  it('buildEspaceMenu ne plante pas et publie un payload SANS clé gouter', () => {
    const menu = buildEspaceMenu(CONFIG, week(oldDay()), byId);
    expect(menu.days).toHaveLength(1);
    expect(menu.days[0].dej?.plat?.n).toBe('Couscous');
    expect('gouter' in menu.days[0]).toBe(false); // additif : jamais de clé vide
  });
});

describe('goûter posé — payload additif, plat seul', () => {
  const dayWithGouter = (): DayMenu => ({
    ...oldDay(),
    gouter: { plat: 'r2' },
  });

  it('usedRecipeIds inclut la recette du goûter (les audios suivront)', () => {
    expect(usedRecipeIds(CONFIG, week(dayWithGouter()))).toEqual(expect.arrayContaining(['r1', 'r2']));
  });

  it('buildEspaceMenu publie le goûter', () => {
    const menu = buildEspaceMenu(CONFIG, week(dayWithGouter()), byId);
    expect(menu.days[0].gouter?.plat?.n).toBe('Cookies aux amandes');
  });

  it('goûter = PLAT SEUL (ruling PO) : entrée/acc ignorés même si présents', () => {
    const sneaky: DayMenu = { ...oldDay(), gouter: { plat: 'r2', entree: 'r1', acc: { id: 'r1', g: 100 } } };
    const menu = buildEspaceMenu(CONFIG, week(sneaky), byId);
    expect(menu.days[0].gouter?.plat?.n).toBe('Cookies aux amandes');
    expect(menu.days[0].gouter?.entree).toBeUndefined();
    expect(menu.days[0].gouter?.acc).toBeUndefined();
  });
});
