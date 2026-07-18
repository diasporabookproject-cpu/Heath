// Garde G3 LEXICAL (prompt v2) — module PUR (aucune dépendance) : partagé par
// l'edge Deno (index.ts) et un test Vitest (guard.test.ts). Même logique de
// normalisation que `matchAllergenes` côté client (casse + accents) — filet
// MÉCANIQUE qui ne dépend pas de l'obéissance du modèle.

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Pour chaque interdit ALIMENTAIRE du foyer (pas `halal` — concept composé hors
 * portée lexicale, option (a) PO ; ni les entrées < 3 lettres = bruit), cherche le
 * mot dans les ingrédients PRODUITS. Match → une alerte (→ bandeau rouge en
 * relecture). Imparfait assumé : recherche littérale, synonymes non couverts
 * (« gluten » ne matche pas « farine de blé »).
 */
export function alerteRegles(regles: string[], ingredients: unknown): string[] {
  const ing = norm(String(ingredients ?? ''));
  const out: string[] = [];
  for (const r of regles) {
    const rn = norm(r).trim();
    if (!rn || rn === 'halal' || rn.length < 3) continue;
    if (ing.includes(rn)) out.push(`« ${r} » présent dans les ingrédients malgré la règle du foyer`);
  }
  return out;
}
