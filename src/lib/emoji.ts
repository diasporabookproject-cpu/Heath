import type { Recipe, RecipeRole } from '../types';

// F7.1 (lot Cuisine T7) — repère EMOJI des cartes recette : mapping DÉTERMINISTE
// mot-clé → repli rôle. Jamais choisi à la main (règle du brief) : la même
// recette porte toujours le même repère, sur tous les appareils.

const MOTS: [RegExp, string][] = [
  [/tajine|tagine/, '🍲'],
  // Proto DA v2 : la soupe est un BOL À CUILLÈRE (🥣), pas un ramen asiatique.
  [/soupe|harira|potage|bouillon/, '🥣'],
  // Proto DA v2 : couscous/mezze = plat mijoté large (🥘) — pas le bol de riz.
  [/couscous|mezze|mezzé|paella/, '🥘'],
  [/briouate|samoussa|nem\b|raviole/, '🥟'],
  [/poulet|dinde|volaille/, '🍗'],
  [/poisson|dorade|sardine|saumon|lotte|crevette|mer\b/, '🐟'],
  [/bœuf|boeuf|kefta|kefta|viande|agneau|brochette/, '🥩'],
  [/salade|crudité/, '🥗'],
  [/œuf|oeuf|omelette|frittata|chakchouka/, '🍳'],
  [/riz|semoule|pâtes|pates/, '🍚'],
  [/pain|msemmen|batbout|sandwich|galette/, '🥖'],
  [/yaourt|fromage|laitage|creami|whey/, '🥛'],
  // AVANT la ligne fruit : « pommes de terre » matchait /pomme/ → 🍓 (découverte
  // PO à la clôture T7, prouvée au code — correction triviale, testée).
  [/pommes? de terre|patate/, '🥔'],
  [/fruit|pomme|banane|fraise|orange/, '🍓'],
  [/légume|legume|courgette|carotte|épinard|epinard|brocoli/, '🥦'],
  [/gâteau|gateau|dessert|halva|chocolat/, '🍰'],
  [/jus|thé|the\b|café|cafe|smoothie/, '🥤'],
];

const PAR_ROLE: Record<RecipeRole, string> = {
  petitdej: '🍳',
  entree: '🥗',
  plat: '🍴', // proto : « Votre plat » naît 🍴 (couverts nus, pas l'assiette du footer)
  acc: '🍚',
  dessert: '🍰',
  soupe: '🥣',
  gouter: '🍪',
  boisson: '🥤',
};

/** Repère de la carte : premier mot-clé du NOM qui matche, sinon le rôle. */
export function recipeEmoji(r: Pick<Recipe, 'nom' | 'role'>): string {
  const nom = r.nom.toLowerCase();
  for (const [re, e] of MOTS) if (re.test(nom)) return e;
  return PAR_ROLE[r.role] ?? '🍽️';
}
