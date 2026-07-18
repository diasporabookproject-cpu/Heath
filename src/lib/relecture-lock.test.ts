import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Verrou G2 (retour Q&A, GO T5) — moitié « transitions » ───────────────────
// « SEULES les 3 surfaces de relecture font Test → Validé. » G2 est une propriété
// TOPOLOGIQUE (unique point de persistance en 'Test', sorties = relectures) — ce
// test STATIQUE la verrouille contre une régression silencieuse : si un futur
// fichier (travail Sécurité, partage T6, n'importe quoi) appelle `validateRecipe`
// ou écrit `statut: 'Validé'` ailleurs que dans les sites recensés, il ÉCHOUE.
// La liste blanche est volontairement exacte : l'étendre = décision consciente.

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.slice(SRC.length + 1).replace(/\\/g, '/');

describe('verrou G2 — topologie des transitions Test → Validé', () => {
  const files = walk(SRC);

  it('validateRecipe n’est appelée QUE depuis les surfaces de relecture', () => {
    const callers = files
      .filter((p) => /validateRecipe/.test(readFileSync(p, 'utf8')))
      .map(rel)
      .sort();
    // Les « 3 relectures » : RelectureSheet (Valider) · fiche brouillon (Valider
    // et ajouter) · édition (Enregistrer et valider) — ces deux-là vivent dans
    // RecipeDetailSheet. + la définition du store, rien d'autre.
    expect(callers).toEqual([
      'cuisine/RecipeDetailSheet.tsx',
      'cuisine/RelectureSheet.tsx',
      'store/useStore.ts',
    ]);
  });

  it('personne d’autre n’écrit `statut: \'Validé\'` (créations recensées seulement)', () => {
    const writers = files
      .filter((p) => /statut:\s*'Validé'/.test(readFileSync(p, 'utf8')))
      .map(rel)
      .sort();
    expect(writers).toEqual([
      'cuisine/AddRecipeSheet.tsx', // création « L'écrire » (naît Validé — recette de l'auteur)
      'data/index.ts', // SEED_RECIPES (source des packs)
      'lib/packs.ts', // installation d'une collection (copies Validé)
      'store/useStore.ts', // validateRecipe — LA transition, gardée par le test ci-dessus
      'views/SecuriteView.tsx', // ⚠ domaine SÉCURITÉ (SecuriteFiche, même enum) — pas une recette
    ]);
  });
});
