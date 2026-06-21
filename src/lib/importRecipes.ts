import type { CalciumFlag, Recipe, RecipeStatus, RecipeType } from '../types';

// Import en lot de recettes depuis du JSON (collé par l'utilisateur).
// Tolérant : accepte un objet seul ou un tableau, normalise les valeurs,
// génère les identifiants manquants, dérive le flag calcium si absent.

const PREFIX: Record<RecipeType, string> = { Déjeuner: 'DEJ', Dîner: 'DIN', 'Coupe-faim': 'CF' };
const STATUTS: RecipeStatus[] = ['Validé', 'Écarté', 'Test'];
const FLAGS: CalciumFlag[] = ['Champion', 'Moyen', 'Faible'];

function normType(v: unknown): RecipeType | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('déj') || s.startsWith('dej')) return 'Déjeuner';
  if (s.startsWith('dîn') || s.startsWith('din')) return 'Dîner';
  if (s.startsWith('coupe')) return 'Coupe-faim';
  return null;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Dérive le flag calcium si non fourni (seuils calés sur le jeu de données). */
export function deriveFlag(calcium: number): CalciumFlag {
  if (calcium >= 350) return 'Champion';
  if (calcium >= 215) return 'Moyen';
  return 'Faible';
}

function nextId(used: Set<string>, type: RecipeType): string {
  const prefix = PREFIX[type];
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

  // Accepte un tableau, un objet seul, ou { recettes: [...] }.
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
    const type = normType(o.type);
    if (!type) {
      errors.push(`${where} (${nom}) : "type" doit être Déjeuner, Dîner ou Coupe-faim.`);
      return;
    }

    const statut = STATUTS.includes(o.statut as RecipeStatus) ? (o.statut as RecipeStatus) : 'Validé';
    const calcium = num(o.calcium);
    const flag = FLAGS.includes(o.flag_calcium as CalciumFlag)
      ? (o.flag_calcium as CalciumFlag)
      : deriveFlag(calcium);

    let id = String(o.id ?? '').trim();
    if (!id || used.has(id)) id = nextId(used, type);
    used.add(id);

    recipes.push({
      id,
      nom,
      type,
      statut,
      jour: String(o.jour ?? 'Tous').trim() || 'Tous',
      kcal: num(o.kcal),
      prot: num(o.prot),
      gluc: num(o.gluc),
      lip: num(o.lip),
      calcium,
      flag_calcium: flag,
      ingredients: String(o.ingredients ?? '').trim(),
      notes: o.notes ? String(o.notes).trim() : undefined,
      nom_ar: o.nom_ar ? String(o.nom_ar).trim() : undefined,
      ingredients_ar: o.ingredients_ar ? String(o.ingredients_ar).trim() : undefined,
    });
  });

  return { recipes, errors };
}
