import { describe, expect, it } from 'vitest';
import { buildInstall, isPackInstalled, missingSeeds, seedExists } from './packs';
import { PACKS } from '../data/packs';
import { SEED_RECIPES } from '../data';
import type { Pack, Recipe } from '../types';

const rec = (nom: string, statut: Recipe['statut'] = 'Validé', packId?: string): Recipe => ({
  id: nom,
  nom,
  role: 'plat',
  statut,
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
    { nom: 'Alpha', role: 'plat', ingredients: 'a' },
    { nom: 'Beta', role: 'entree', ingredients: 'b' },
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

// ── F2 (Flow FTUE) — la collection « Fonds de départ » remplace l'import auto ──
describe('packs — Fonds de départ', () => {
  const fonds = PACKS.find((p) => p.id === 'fonds-de-depart')!;

  it('est au registre, avec 30 recettes (l’Écartée du seed est SORTIE)', () => {
    expect(fonds).toBeDefined();
    expect(fonds.recettes.length).toBe(30);
    const ecartees = SEED_RECIPES.filter((r) => r.statut === 'Écarté').map((r) => r.nom.toLowerCase());
    expect(ecartees.length).toBeGreaterThan(0); // le seed contient bien une Écartée
    expect(fonds.recettes.some((s) => ecartees.includes(s.nom.toLowerCase()))).toBe(false);
  });

  it('s’installe intégralement sur une bibliothèque VIDE (ids neufs, Validé, packId)', () => {
    const added = buildInstall(fonds, [], new Set(fonds.recettes.map((r) => r.nom)));
    expect(added.length).toBe(30);
    expect(added.every((r) => r.statut === 'Validé' && r.packId === 'fonds-de-depart')).toBe(true);
    expect(new Set(added.map((r) => r.id)).size).toBe(30);
    // la darija du seed voyage avec la collection
    expect(added.every((r) => !!r.nom_ar)).toBe(true);
  });

  it('dédup par nom contre les packs qui le recouvrent (marocain-quotidien conservé exprès)', () => {
    const marocain = PACKS.find((p) => p.id === 'marocain-quotidien')!;
    const biblio = buildInstall(fonds, [], new Set(fonds.recettes.map((r) => r.nom)));
    // installer marocain-quotidien APRÈS le Fonds → seules ses recettes vraiment
    // nouvelles s'ajoutent (recouvrement attendu, banc d'essai de la dédup).
    const extra = buildInstall(marocain, biblio, new Set(marocain.recettes.map((r) => r.nom)));
    const noms = new Set(biblio.map((r) => r.nom.toLowerCase()));
    expect(extra.every((r) => !noms.has(r.nom.toLowerCase()))).toBe(true);
    // et réinstaller le Fonds sur lui-même → zéro ajout
    expect(buildInstall(fonds, biblio, new Set(fonds.recettes.map((r) => r.nom)))).toEqual([]);
  });
});
