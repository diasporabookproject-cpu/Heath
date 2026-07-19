// DA v2 (lot UI, T1) — génère `src/assets/fluent-emoji.ts` : le sous-ensemble
// EMBARQUÉ du jeu Fluent Emoji Flat (Microsoft, licence MIT, via
// @iconify-json/fluent-emoji-flat). Invariant offline : JAMAIS de CDN dans
// l'app — le CDN des maquettes est une béquille d'aperçu, pas un modèle.
//
// Le fichier généré est COMMITTÉ (déterministe : même entrée → même sortie) ;
// ce script ne tourne qu'à la curation (ajout/retrait d'un repère), pas au build.
// Usage : node scripts/gen-fluent.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const set = JSON.parse(readFileSync(require.resolve('@iconify-json/fluent-emoji-flat/icons.json'), 'utf8'));

// Caractère → nom Fluent. LA liste de curation : tous les pictos que l'app peut
// afficher (emoji.ts, MEAL_PICTO, MOMENT_PICTO, KIND_PICTO, B1, footer Cuisine,
// radial). Un caractère absent d'ici retombe sur l'emoji système (repli doux).
const CHARS = {
  // — B1 (accueil) —
  '👤': 'bust-in-silhouette',
  '🧸': 'teddy-bear',
  '🛡️': 'shield',
  '🍲': 'pot-of-food',
  '🏊': 'person-swimming',
  '📌': 'pushpin',
  // — repas (MEAL_PICTO + composeur) —
  '🥐': 'croissant',
  '🥘': 'shallow-pan-of-food',
  '🌙': 'crescent-moon',
  '🍽️': 'fork-and-knife-with-plate',
  '🍴': 'fork-and-knife',
  '🍪': 'cookie',
  // — moments Nounou (MOMENT_PICTO) —
  '⏰': 'alarm-clock',
  '🏫': 'school',
  '😴': 'sleeping-face',
  '🍎': 'red-apple',
  '🛁': 'bathtub',
  '🧺': 'basket',
  '🩺': 'stethoscope',
  '⚽': 'soccer-ball',
  // — dictionnaire recettes (emoji.ts : MOTS + PAR_ROLE) —
  '🍜': 'steaming-bowl',
  '🍗': 'poultry-leg',
  '🐟': 'fish',
  '🥩': 'cut-of-meat',
  '🥗': 'green-salad',
  '🍳': 'cooking',
  '🍚': 'cooked-rice',
  '🥖': 'baguette-bread',
  '🥛': 'glass-of-milk',
  '🥔': 'potato',
  '🍓': 'strawberry',
  '🥦': 'broccoli',
  '🍰': 'shortcake',
  '🥤': 'cup-with-straw',
  '🥣': 'bowl-with-spoon',
  // — Cuisine DA v2 (footer, pastille règles, radial, collections) —
  '📖': 'open-book',
  '🛒': 'shopping-cart',
  '🌿': 'herb',
  '✏️': 'pencil',
  '📸': 'camera-with-flash',
  '📚': 'books',
  '🧑‍🍳': 'cook',
  '🍱': 'bento-box',
};

const entries = [];
for (const [ch, name] of Object.entries(CHARS)) {
  const icon = set.icons[name];
  if (!icon) {
    console.error(`✗ icône absente du jeu : ${name} (${ch})`);
    process.exit(1);
  }
  const w = icon.width ?? set.width ?? 32;
  const h = icon.height ?? set.height ?? 32;
  entries.push({ ch, name, w, h, body: icon.body });
}

const out = `// GÉNÉRÉ par scripts/gen-fluent.mjs — NE PAS ÉDITER À LA MAIN.
// Sous-ensemble Fluent Emoji Flat © Microsoft — licence MIT
// (https://github.com/microsoft/fluentui-emoji) via @iconify-json/fluent-emoji-flat.
// Embarqué dans le bundle : rendu identique Android/iOS, AUCUNE requête réseau
// (invariant offline). Repli : caractère système si absent de la carte.

export interface FluentIcon {
  /** viewBox width/height (grille 32×32 du jeu). */
  w: number;
  h: number;
  /** Corps SVG (paths), à rendre dans un <svg viewBox="0 0 w h">. */
  body: string;
}

export const FLUENT: Record<string, FluentIcon> = {
${entries.map((e) => `  ${JSON.stringify(e.ch)}: { w: ${e.w}, h: ${e.h}, body: ${JSON.stringify(e.body)} }, // ${e.name}`).join('\n')}
};
`;
writeFileSync('src/assets/fluent-emoji.ts', out);
console.log(`✓ src/assets/fluent-emoji.ts — ${entries.length} repères embarqués`);
