import type { Pack, Recipe, RecipeSeed } from '../types';
import { nextRecipeId } from './recipeId';

// Installation d'un pack (L3-4) — PURE & testable. Copie les recettes cochées
// dans la bibliothèque de l'utilisateur (nouveaux ids, `Validé`, `packId`), hors
// file de relecture. Anti-doublon par NOM : évite de dupliquer une recette déjà
// présente (bibliothèque existante OU réinstallation) — plus robuste que
// `packId + nom` seul (couvre aussi le pack « seed » déjà en bibliothèque).

const norm = (s: string) => s.trim().toLowerCase();

/** Une recette de pack est-elle déjà dans la bibliothèque (par nom, hors écartées) ? */
export function seedExists(seed: RecipeSeed, recipes: Recipe[]): boolean {
  return recipes.some((r) => r.statut !== 'Écarté' && norm(r.nom) === norm(seed.nom));
}

/** Recettes du pack encore absentes de la bibliothèque. */
export function missingSeeds(pack: Pack, recipes: Recipe[]): RecipeSeed[] {
  return pack.recettes.filter((s) => !seedExists(s, recipes));
}

/** Pack installé = toutes ses recettes sont présentes. */
export function isPackInstalled(pack: Pack, recipes: Recipe[]): boolean {
  return pack.recettes.every((s) => seedExists(s, recipes));
}

/**
 * Recettes à AJOUTER pour installer `pack`, limitées aux noms cochés et aux
 * recettes encore absentes (anti-doublon). Ids neufs, `Validé`, `packId`.
 */
export function buildInstall(pack: Pack, recipes: Recipe[], chosen: Set<string>): Recipe[] {
  const pool = [...recipes];
  const out: Recipe[] = [];
  for (const s of pack.recettes) {
    if (!chosen.has(s.nom)) continue;
    if (seedExists(s, pool)) continue;
    const id = nextRecipeId(pool, s.role);
    const rec: Recipe = { ...s, id, statut: 'Validé', packId: pack.id };
    pool.push(rec);
    out.push(rec);
  }
  return out;
}
