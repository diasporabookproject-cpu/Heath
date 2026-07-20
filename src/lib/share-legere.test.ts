import { describe, expect, it } from 'vitest';
import { buildEspaceMenu } from './share';
import type { AppConfig, DayMenu, Recipe, WeekMenu } from '../types';

// T4 (SPEC 5 / Q2, ruling PO) — TEST BLOQUANT « recette LÉGÈRE » : une Recipe
// avec SEULEMENT un nom (« yaourt », ingrédients/étapes vides) est un état
// valide de bout en bout. Ici : la moitié PAYLOAD (posée au menu → publiée →
// le nom arrive sur la page reçue ; le garde allergènes reste couvert par le
// NOM). La moitié RENDU vit dans espace-legere (page reçue), et le parcours
// complet dans le smoke (création UI sans ingrédients → aperçu cuisinière).

const CONFIG: AppConfig = { jours: [{ key: 'mar', nom: 'Mardi' }] };

const yaourt: Recipe = {
  id: 'g1',
  nom: 'Yaourt',
  role: 'gouter',
  statut: 'Validé',
  ingredients: '', // ← le cœur du test : chaîne vide, PAS un champ retiré
};

const byId = new Map([[yaourt.id, yaourt]]);
const day: DayMenu = {
  petitdej: { plat: null },
  dej: { plat: null, entree: null, acc: null },
  diner: { plat: null, entree: null, acc: null },
  gouter: { plat: 'g1' },
};
const week: WeekMenu = { id: 'current', days: { mar: day } };

describe('recette légère — payload publié (nom seul)', () => {
  it('le yaourt posé au goûter arrive dans le payload, ingrédients vides sans crash', () => {
    const menu = buildEspaceMenu(CONFIG, week, byId);
    expect(menu.days).toHaveLength(1);
    expect(menu.days[0].gouter?.plat?.n).toBe('Yaourt');
    expect(menu.days[0].gouter?.plat?.i).toBe('');
  });

  it('le garde allergènes reste couvert : le NOM matche même sans ingrédients', () => {
    const menu = buildEspaceMenu(CONFIG, week, byId, undefined, ['yaourt']);
    expect(menu.days[0].gouter?.plat?.w).toEqual(['yaourt']);
  });

  it('pas de faux positif : règle absente du nom → pas d’alerte', () => {
    const menu = buildEspaceMenu(CONFIG, week, byId, undefined, ['arachide']);
    expect(menu.days[0].gouter?.plat?.w).toBeUndefined();
  });
});
