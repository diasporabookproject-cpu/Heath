import type { CalciumFlag, Macros } from '../types';

// Auto-calcul des macros (concept central 2.3) — base nutritionnelle « best-effort »
// côté client, hors-ligne. Imparfaite par nature → résultats marqués « estimées ».
// L'estimation LLM (edge function) est préférée quand elle est disponible (lib/ai.ts).
//
// On NE normalise PAS les càc/càs dans le texte affiché ; ici on ne sert qu'à
// convertir en grammes pour le calcul nutritionnel interne.

/** Table par 100 g (sauf œuf : par 100 g ≈ 2 œufs). Calcium = enjeu n°1, soigné. */
const TABLE: Record<string, Macros> = {
  // protéines animales
  poulet: { kcal: 165, prot: 31, gluc: 0, lip: 4, calcium: 12 },
  dinde: { kcal: 135, prot: 29, gluc: 0, lip: 2, calcium: 12 },
  boeuf: { kcal: 250, prot: 26, gluc: 0, lip: 17, calcium: 18 },
  kefta: { kcal: 250, prot: 24, gluc: 0, lip: 17, calcium: 20 },
  agneau: { kcal: 280, prot: 25, gluc: 0, lip: 20, calcium: 17 },
  saumon: { kcal: 208, prot: 20, gluc: 0, lip: 13, calcium: 12 },
  thon: { kcal: 130, prot: 28, gluc: 0, lip: 1, calcium: 8 },
  poisson: { kcal: 100, prot: 20, gluc: 0, lip: 2, calcium: 30 },
  crevette: { kcal: 99, prot: 24, gluc: 0, lip: 0, calcium: 70 },
  sardine: { kcal: 208, prot: 25, gluc: 0, lip: 11, calcium: 382 },
  oeuf: { kcal: 155, prot: 13, gluc: 1, lip: 11, calcium: 56 },
  // féculents / légumineuses
  riz: { kcal: 130, prot: 3, gluc: 28, lip: 0, calcium: 10 },
  'pois chiche': { kcal: 164, prot: 9, gluc: 27, lip: 3, calcium: 49 },
  lentille: { kcal: 116, prot: 9, gluc: 20, lip: 0, calcium: 19 },
  quinoa: { kcal: 120, prot: 4, gluc: 21, lip: 2, calcium: 17 },
  'patate douce': { kcal: 86, prot: 2, gluc: 20, lip: 0, calcium: 30 },
  'pomme de terre': { kcal: 77, prot: 2, gluc: 17, lip: 0, calcium: 12 },
  'petits pois': { kcal: 81, prot: 5, gluc: 14, lip: 0, calcium: 25 },
  // laitages (calcium ++)
  feta: { kcal: 264, prot: 14, gluc: 4, lip: 21, calcium: 493 },
  fromage: { kcal: 350, prot: 25, gluc: 2, lip: 28, calcium: 700 },
  yaourt: { kcal: 60, prot: 4, gluc: 5, lip: 3, calcium: 120 },
  kefir: { kcal: 41, prot: 3, gluc: 5, lip: 1, calcium: 120 },
  lait: { kcal: 42, prot: 3, gluc: 5, lip: 1, calcium: 120 },
  // graines / oléagineux (calcium ++)
  amande: { kcal: 579, prot: 21, gluc: 22, lip: 50, calcium: 269 },
  tahini: { kcal: 595, prot: 17, gluc: 21, lip: 54, calcium: 426 },
  sesame: { kcal: 573, prot: 18, gluc: 23, lip: 50, calcium: 975 },
  // légumes
  brocoli: { kcal: 34, prot: 3, gluc: 7, lip: 0, calcium: 47 },
  epinard: { kcal: 23, prot: 3, gluc: 4, lip: 0, calcium: 99 },
  tomate: { kcal: 18, prot: 1, gluc: 4, lip: 0, calcium: 10 },
  concombre: { kcal: 15, prot: 1, gluc: 4, lip: 0, calcium: 16 },
  poivron: { kcal: 31, prot: 1, gluc: 6, lip: 0, calcium: 10 },
  courgette: { kcal: 17, prot: 1, gluc: 3, lip: 0, calcium: 16 },
  oignon: { kcal: 40, prot: 1, gluc: 9, lip: 0, calcium: 23 },
  avocat: { kcal: 160, prot: 2, gluc: 9, lip: 15, calcium: 12 },
  legume: { kcal: 35, prot: 2, gluc: 6, lip: 0, calcium: 40 },
  // matières grasses
  huile: { kcal: 884, prot: 0, gluc: 0, lip: 100, calcium: 1 },
};

// Normalisation des accents pour la recherche de mots-clés.
const deburr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TABLE_KEYS = Object.keys(TABLE).map((k) => ({ key: k, norm: deburr(k) }));

/** Grammes d'un segment d'ingrédient (gère g, càc/càs, défaut 100 g si mot connu). */
function gramsOf(seg: string): number {
  const m = seg.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  const cac = seg.match(/(\d+(?:[.,]\d+)?)?\s*c[àa]c/);
  if (cac) return (cac[1] ? parseFloat(cac[1].replace(',', '.')) : 1) * 5;
  const cas = seg.match(/(\d+(?:[.,]\d+)?)?\s*c[àa]s/);
  if (cas) return (cas[1] ? parseFloat(cas[1].replace(',', '.')) : 1) * 15;
  return 100; // pas de quantité → portion par défaut
}

/** Flag calcium déduit du total (enjeu n°1). */
export function calciumFlag(calcium: number): CalciumFlag {
  if (calcium >= 300) return 'Champion';
  if (calcium >= 150) return 'Moyen';
  return 'Faible';
}

export interface MacroEstimate extends Macros {
  flag_calcium: CalciumFlag;
  /** Nombre de segments reconnus / total (pour signaler une estimation partielle). */
  matched: number;
  total: number;
}

/**
 * Estime les macros d'UNE portion à partir du texte d'ingrédients.
 * Best-effort : sépare par « · » et « + », reconnaît les mots-clés connus.
 */
export function estimateMacrosLocal(ingredients: string): MacroEstimate {
  const segments = ingredients
    .split(/·|\n|\++/)
    .map((s) => s.trim())
    .filter(Boolean);

  let acc: Macros = { kcal: 0, prot: 0, gluc: 0, lip: 0, calcium: 0 };
  let matched = 0;

  for (const seg of segments) {
    const norm = deburr(seg);
    const hit = TABLE_KEYS.find((t) => norm.includes(t.norm));
    if (!hit) continue;
    matched++;
    const per100 = TABLE[hit.key];
    const f = gramsOf(seg) / 100;
    acc = {
      kcal: acc.kcal + per100.kcal * f,
      prot: acc.prot + per100.prot * f,
      gluc: acc.gluc + per100.gluc * f,
      lip: acc.lip + per100.lip * f,
      calcium: acc.calcium + per100.calcium * f,
    };
  }

  const round = (n: number) => Math.round(n);
  const calcium = round(acc.calcium);
  return {
    kcal: round(acc.kcal),
    prot: round(acc.prot),
    gluc: round(acc.gluc),
    lip: round(acc.lip),
    calcium,
    flag_calcium: calciumFlag(calcium),
    matched,
    total: segments.length,
  };
}
