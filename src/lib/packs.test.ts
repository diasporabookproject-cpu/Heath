import { describe, expect, it } from 'vitest';
import { buildInstall, isPackInstalled, missingSeeds, seedExists } from './packs';
import type { Pack, Recipe } from '../types';

const rec = (nom: string, statut: Recipe['statut'] = 'Validé', packId?: string): Recipe => ({
  id: nom,
  nom,
  role: 'plat',
  statut,
  kcal: 500,
  prot: 30,
  gluc: 40,
  lip: 15,
  calcium: 200,
  flag_calcium: 'Moyen',
  ingredients: 'x',
  packId,
});

const pack: Pack = {
  id: 'demo',
  nom: 'Démo',
  emoji: '🥗',
  description: '',
  version: 1,
  recettes: [
    { nom: 'Alpha', role: 'plat', kcal: 400, prot: 20, gluc: 30, lip: 10, calcium: 100, flag_calcium: 'Moyen', ingredients: 'a' },
    { nom: 'Beta', role: 'entree', kcal: 300, prot: 15, gluc: 20, lip: 8, calcium: 80, flag_calcium: 'Faible', ingredients: 'b' },
  ],
};

const all = (p: Pack) => new Set(p.recettes.map((r) => r.nom));

describe('packs — install', () => {
  it('seedExists : par nom, insensible à la casse, hors écartées', () => {
    expect(seedExists(pack.recettes[0], [rec('alpha')])).toBe(true);
    expect(seedExists(pack.recettes[0], [rec('Alpha', 'Écarté')])).toBe(false);
    expect(seedExists(pack.recettes[0], [rec('Autre')])).toBe(false);
  });

  it('isPackInstalled / missingSeeds', () => {
    expect(isPackInstalled(pack, [])).toBe(false);
    expect(missingSeeds(pack, []).length).toBe(2);
    expect(isPackInstalled(pack, [rec('Alpha'), rec('Beta')])).toBe(true);
    expect(missingSeeds(pack, [rec('Alpha')]).map((s) => s.nom)).toEqual(['Beta']);
  });

  it('buildInstall : ids neufs, Validé, packId ; respecte les cochées', () => {
    const added = buildInstall(pack, [], all(pack));
    expect(added.map((r) => r.nom)).toEqual(['Alpha', 'Beta']);
    expect(added.every((r) => r.statut === 'Validé' && r.packId === 'demo')).toBe(true);
    expect(new Set(added.map((r) => r.id)).size).toBe(2); // ids distincts
    // seulement Alpha cochée
    expect(buildInstall(pack, [], new Set(['Alpha'])).map((r) => r.nom)).toEqual(['Alpha']);
  });

  it('anti-doublon : réinstallation n’ajoute que les manquantes', () => {
    const existing = [rec('Alpha', 'Validé', 'demo')];
    expect(buildInstall(pack, existing, all(pack)).map((r) => r.nom)).toEqual(['Beta']);
    // tout déjà là → rien
    expect(buildInstall(pack, [rec('Alpha'), rec('Beta')], all(pack))).toEqual([]);
  });
});
