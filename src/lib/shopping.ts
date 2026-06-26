import type { AppConfig, Recipe, WeekMenu } from '../types';

// ── Liste de courses (P1 #10) ───────────────────────────────────────────────
// Les ingrédients sont du texte libre. On fait un parsing « best-effort » :
// on découpe, on extrait une quantité, on fusionne les mêmes ingrédients,
// et on classe par rayon. Imparfait par nature, mais utile et lisible.

export interface ParsedItem {
  name: string; // nom nettoyé (pour affichage)
  key: string; // clé de regroupement (normalisée)
  qty: number | null;
  unit: string | null; // 'g' | 'kg' | 'mg' | 'ml' | 'cl' | 'l' | 'càc' | 'càs' | 'pièce'
}

const FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅙': 1 / 6,
  '⅛': 0.125,
};

// Mots d'état de cuisson / préparation à retirer pour mieux fusionner.
// (Comparaison mot-à-mot, donc pas de souci de frontières d'accents.)
const STRIP_SET = new Set([
  'cuit', 'cuite', 'cuits', 'cuites', 'cru', 'crue', 'crus', 'crues',
  'grillé', 'grillée', 'grillés', 'grillées', 'grille',
  'rôti', 'rôtie', 'rôtis', 'rôties', 'roti', 'rotis',
  'vapeur', 'saisi', 'saisie',
  'mijoté', 'mijotée', 'mijotés', 'mijotées',
  'frais', 'fraîche', 'fraîches', 'fraiche', 'fraiches',
  'égoutté', 'égouttée', 'égouttés', 'égouttées', 'émiettés', 'émincé', 'émincée',
  'tranché', 'tranchée', 'tranchées', 'dur', 'durs', 'chair', 'boulette', 'boulettes',
  'répartie', 'pressés', 'pressées', 'surgelés', 'surgelées', 'sg',
  'râpé', 'râpée', 'râpés', 'rapé', 'rapée', 'càc', 'càs', 'cuillère', 'cuillères',
]);

// Locutions de préparation (multi-mots) retirées avant le découpage en mots.
const PREP_PHRASES = /(en cubes|en dés|en dameier|coupé minute|coupé|écorce rincée|bien pressés|bien pressées)/gi;

// Fusion singulier/pluriel pour les cas fréquents.
const SYNONYMS: Record<string, string> = {
  œufs: 'œuf',
  oeufs: 'œuf',
  oeuf: 'œuf',
};

function fracToNum(token: string): number {
  if (FRACTIONS[token] != null) return FRACTIONS[token];
  return parseFloat(token.replace(',', '.'));
}

function normUnit(u: string): string {
  return u.toLowerCase().replace(/\./g, '');
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse un fragment d'ingrédient en {nom, quantité, unité}. */
export function parseItem(raw: string): ParsedItem | null {
  let s = raw
    .replace(/\([^)]*\)/g, ' ') // retire les parenthèses (séparé, option, repos…)
    .replace(/~/g, ' ')
    .trim();
  if (!s) return null;

  let qty: number | null = null;
  let unit: string | null = null;

  // 1) quantité avec unité, ex. "200g", "1 càc", "130-150g" (on prend la 1re valeur)
  const unitRe =
    /(\d+(?:[.,]\d+)?)(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(kg|g|mg|ml|cl|l|càc|càs|c\.à\.c|c\.à\.s)\b/i;
  const m = s.match(unitRe);
  if (m) {
    qty = parseFloat(m[1].replace(',', '.'));
    unit = normUnit(m[2]);
    s = s.replace(m[0], ' ');
  } else {
    // 2) quantité en nombre/fraction en tête, ex. "2 œufs", "¼ citron"
    const fm = s.match(/^\s*([¼½¾⅓⅔⅙⅛]|\d+(?:[.,]\d+)?)\s+(.+)/);
    if (fm) {
      qty = fracToNum(fm[1]);
      unit = 'pièce';
      s = fm[2];
    }
  }

  // Nettoyage : locutions de prép., puis découpage en mots et filtrage
  // (retire états de cuisson, nombres/unités résiduels, %, fractions seules).
  s = s.replace(PREP_PHRASES, ' ').replace(/[/]/g, ' ');
  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => {
      const lw = w.toLowerCase().replace(/[.,;·]+$/g, '');
      if (!lw) return false;
      if (STRIP_SET.has(lw)) return false;
      // nombre seul, ou quantité/plage résiduelle (130, 110g, 130-150g)
      if (/^\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?(?:kg|g|mg|ml|cl|l)?$/.test(lw)) return false;
      if (/^\d+\s*%$/.test(lw) || lw === '%') return false;
      if (/^[¼½¾⅓⅔⅙⅛]$/.test(w)) return false;
      return true;
    });

  s = words.join(' ').replace(/^[\s,;·.\-]+|[\s,;·.\-]+$/g, '').trim();
  if (!s) return null;

  let key = s.toLowerCase();
  let name = titleCase(s);
  if (SYNONYMS[key]) {
    key = SYNONYMS[key];
    name = titleCase(key);
  }
  return { name, key, qty, unit };
}

/** Découpe la chaîne d'ingrédients d'une recette en items. */
export function parseIngredients(text: string): ParsedItem[] {
  if (!text) return [];
  const items: ParsedItem[] = [];
  for (const chunk of text.split('·')) {
    // Le " + " entouré d'espaces sépare des items distincts ;
    // "huile+citron+cumin" (sans espaces) reste un assaisonnement groupé.
    for (const part of chunk.split(/\s+\+\s+/)) {
      const item = parseItem(part);
      if (item) items.push(item);
    }
  }
  return items;
}

// ── Classement par rayon ─────────────────────────────────────────────────────
interface Rayon {
  id: string;
  label: string;
  keywords: string[];
}

// Ordre = priorité de classement (premier rayon dont un mot-clé matche).
const RAYONS: Rayon[] = [
  {
    id: 'poissonnerie',
    label: '🐟 Poissonnerie',
    keywords: ['saumon', 'dorade', 'lotte', 'sardine', 'thon', 'crevette', 'merlan', 'loup', 'poisson'],
  },
  {
    id: 'boucherie',
    label: '🥩 Boucherie & volaille',
    keywords: ['poulet', 'dinde', 'bœuf', 'boeuf', 'kefta', 'rumsteck', 'rôti de', 'viande'],
  },
  {
    id: 'cremerie',
    label: '🥚 Crémerie & œufs',
    keywords: ['œuf', 'oeuf', 'feta', 'comté', 'comte', 'yaourt', 'kéfir', 'kefir', 'fromage', 'lait', 'whey', 'blancs d', 'blanc d'],
  },
  {
    id: 'primeur',
    label: '🥦 Fruits & légumes',
    keywords: [
      'tomate', 'concombre', 'poivron', 'oignon', 'courgette', 'aubergine', 'brocoli', 'épinard',
      'epinard', 'haricot', 'carotte', 'salade', 'laitue', 'avocat', 'citron vert', 'banane', 'fruit',
      'légume', 'legume', 'ail', 'gingembre', 'coriandre', 'persil', 'jalapeño', 'jalapeno', 'radis',
      'céleri', 'celeri', 'chou', 'patate douce', 'crudités', 'crudites', 'fruits rouges', 'thym', 'romarin', 'menthe',
    ],
  },
  {
    id: 'epicerie',
    label: '🌾 Féculents & épicerie',
    keywords: ['riz', 'pois chiche', 'lentille', 'batbout', 'olives', 'câpres', 'capres'],
  },
  {
    id: 'condiments',
    label: '🧂 Épices & condiments',
    keywords: [
      'huile', 'tahini', 'vinaigre', 'tamari', 'cumin', 'paprika', 'curcuma', 'safran', 'chermoula',
      'moutarde', 'sel', 'poivre', 'épice', 'epice', 'érythritol', 'estéviol', 'esteviol', 'gomme guar',
      'cacao', 'vanille', 'sauce', 'marinade', 'citron confit', 'citron', 'gomme',
    ],
  },
];

export function rayonFor(key: string): Rayon {
  for (const r of RAYONS) {
    if (r.keywords.some((k) => key.includes(k))) return r;
  }
  return { id: 'autres', label: '🛒 Autres', keywords: [] };
}

export interface AggLine {
  name: string;
  qty: number | null;
  unit: string | null;
  count: number; // nb d'occurrences (utile si quantité non lisible)
}

export interface RayonGroup {
  id: string;
  label: string;
  lines: AggLine[];
}

/**
 * Construit la liste de courses agrégée à partir de la semaine.
 * `persons` met à l'échelle les quantités (recettes = 1 portion) ; défaut 1.
 */
export function buildShoppingList(
  config: AppConfig,
  week: WeekMenu,
  recipesById: Map<string, Recipe>,
  persons = 1,
): RayonGroup[] {
  const factor = Math.max(1, persons);
  // Map rayonId -> Map aggKey -> AggLine
  const groups = new Map<string, { label: string; lines: Map<string, AggLine> }>();

  const addRecipe = (id: string | null) => {
    if (!id) return;
    const recipe = recipesById.get(id);
    if (!recipe) return;
    for (const item of parseIngredients(recipe.ingredients)) {
      const rayon = rayonFor(item.key);
      if (!groups.has(rayon.id)) groups.set(rayon.id, { label: rayon.label, lines: new Map() });
      const lines = groups.get(rayon.id)!.lines;
      const aggKey = item.key + '|' + (item.unit ?? '');
      const scaledQty = item.qty != null ? item.qty * factor : null;
      const existing = lines.get(aggKey);
      if (existing) {
        existing.count += 1;
        if (scaledQty != null) existing.qty = (existing.qty ?? 0) + scaledQty;
      } else {
        lines.set(aggKey, { name: item.name, qty: scaledQty, unit: item.unit, count: 1 });
      }
    }
  };

  for (const j of config.jours) {
    const day = week.days[j.key];
    if (!day) continue;
    addRecipe(day.dejId);
    addRecipe(day.dinId);
    for (const ex of day.extras) addRecipe(ex);
  }

  // Respecte l'ordre des rayons défini ci-dessus, puis "Autres".
  const order = [...RAYONS.map((r) => r.id), 'autres'];
  const result: RayonGroup[] = [];
  for (const id of order) {
    const g = groups.get(id);
    if (!g) continue;
    const lines = [...g.lines.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    result.push({ id, label: g.label, lines });
  }
  return result;
}

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}

/** Quantité lisible pour une ligne. */
export function formatQty(line: AggLine): string {
  if (line.qty == null) return line.count > 1 ? `×${line.count}` : '';
  if (line.unit === 'g' && line.qty >= 1000) return `${fmtNum(line.qty / 1000)} kg`;
  if (line.unit === 'pièce') {
    const p = line.qty <= 1 ? 'pièce' : 'pièces';
    return `${fmtNum(line.qty)} ${p}`;
  }
  return `${fmtNum(line.qty)} ${line.unit ?? ''}`.trim();
}

/** Texte prêt à copier (WhatsApp/SMS). */
export function formatShoppingText(groups: RayonGroup[]): string {
  const blocks: string[] = ['*Liste de courses*'];
  for (const g of groups) {
    const lines = g.lines.map((l) => {
      const q = formatQty(l);
      return q ? `- ${l.name} — ${q}` : `- ${l.name}`;
    });
    blocks.push(`\n${g.label}\n${lines.join('\n')}`);
  }
  return blocks.join('\n');
}
