import type { Recipe, RecipeRole, RecipeStatus } from '../types';

// Import en lot de recettes depuis du JSON (collé par l'utilisateur).
// Tolérant : objet seul ou tableau, normalise, génère les ids manquants.
// Le RÔLE remplace l'ancien "type". (Lot simplification : macros ignorées.)

const PREFIX: Record<RecipeRole, string> = {
  petitdej: 'PDJ', entree: 'ENT', plat: 'PLT', acc: 'ACC',
  dessert: 'DES', soupe: 'SOU', gouter: 'GOU', boisson: 'BOI', // F5.2
};
const STATUTS: RecipeStatus[] = ['Validé', 'Écarté', 'Test'];

/** Normalise un rôle, en tolérant les anciens "type" (Déjeuner/Dîner/Coupe-faim). */
function normRole(v: unknown): RecipeRole {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('petit') || s.startsWith('pdj')) return 'petitdej';
  if (s.startsWith('soupe') || s.startsWith('potage')) return 'soupe'; // F5.2
  if (s.startsWith('entr') || s.startsWith('coupe')) return 'entree';
  if (s.startsWith('acc') || s.startsWith('garniture')) return 'acc';
  if (s.startsWith('dessert')) return 'dessert'; // F5.2
  if (s.startsWith('go')) return 'gouter'; // goûter / gouter (F5.2)
  if (s.startsWith('boisson') || s.startsWith('jus')) return 'boisson'; // F5.2
  // déjeuner/dîner/plat (et défaut) → plat
  return 'plat';
}

function nextId(used: Set<string>, role: RecipeRole): string {
  const prefix = PREFIX[role];
  let max = 0;
  for (const id of used) {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let n = max + 1;
  let id = `${prefix}-${String(n).padStart(2, '0')}`;
  while (used.has(id)) {
    n += 1;
    id = `${prefix}-${String(n).padStart(2, '0')}`;
  }
  return id;
}

export interface ImportResult {
  recipes: Recipe[];
  errors: string[];
}

export function parseRecipesJson(text: string, existing: Recipe[]): ImportResult {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { recipes: [], errors: ['JSON invalide : ' + (e as Error).message] };
  }

  let list: unknown[];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object' && Array.isArray((data as { recettes?: unknown[] }).recettes))
    list = (data as { recettes: unknown[] }).recettes;
  else list = [data];

  const used = new Set(existing.map((r) => r.id));
  const recipes: Recipe[] = [];

  list.forEach((raw, i) => {
    const where = `Recette #${i + 1}`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${where} : ce n'est pas un objet.`);
      return;
    }
    const o = raw as Record<string, unknown>;
    const nom = String(o.nom ?? '').trim();
    if (!nom) {
      errors.push(`${where} : champ "nom" manquant.`);
      return;
    }
    const role = normRole(o.role ?? o.type);
    const statut = STATUTS.includes(o.statut as RecipeStatus) ? (o.statut as RecipeStatus) : 'Validé';

    let id = String(o.id ?? '').trim();
    if (!id || used.has(id)) id = nextId(used, role);
    used.add(id);

    recipes.push({
      id,
      nom,
      role,
      statut,
      ingredients: String(o.ingredients ?? '').trim(),
      etapes: o.etapes ? String(o.etapes).trim() : undefined,
      notes: o.notes ? String(o.notes).trim() : undefined,
      nom_ar: o.nom_ar ? String(o.nom_ar).trim() : undefined,
      ingredients_ar: o.ingredients_ar ? String(o.ingredients_ar).trim() : undefined,
      etapes_ar: o.etapes_ar ? String(o.etapes_ar).trim() : undefined,
    });
  });

  return { recipes, errors };
}
