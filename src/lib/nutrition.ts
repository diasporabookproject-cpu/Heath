import type {
  AppConfig,
  Cibles,
  DayConfig,
  DayMenu,
  Feu,
  Macros,
  Recipe,
} from '../types';

const EMPTY: Macros = { kcal: 0, prot: 0, gluc: 0, lip: 0, calcium: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    gluc: a.gluc + b.gluc,
    lip: a.lip + b.lip,
    calcium: a.calcium + b.calcium,
  };
}

function recipeMacros(r: Recipe | undefined): Macros {
  if (!r) return EMPTY;
  return { kcal: r.kcal, prot: r.prot, gluc: r.gluc, lip: r.lip, calcium: r.calcium };
}

/**
 * Totaux d'une journée = déjeuner + dîner + extras
 * + les DEUX éléments fixes toujours comptés (collation + kéfir du coucher).
 * Voir BRIEF_PRODUIT.md §4 et §7.
 */
export function dayTotals(
  day: DayMenu,
  recipesById: Map<string, Recipe>,
  config: AppConfig,
): Macros {
  let total: Macros = addMacros(
    config.elements_fixes.collation,
    config.elements_fixes.kefir_coucher,
  );
  total = addMacros(total, recipeMacros(day.dejId ? recipesById.get(day.dejId) : undefined));
  total = addMacros(total, recipeMacros(day.dinId ? recipesById.get(day.dinId) : undefined));
  for (const id of day.extras) {
    total = addMacros(total, recipeMacros(recipesById.get(id)));
  }
  return total;
}

// Petite tolérance pour que les valeurs pile sur la borne (ex. exactement ±10 %)
// comptent du bon côté malgré les arrondis flottants.
const EPS = 1e-9;

/** Feu des calories : comparées à la cible du jour (selon son type). */
export function feuKcal(total: number, cible: number, cibles: Cibles): Feu {
  if (cible <= 0) return 'rouge';
  const ecart = Math.abs(total - cible) / cible;
  if (ecart <= cibles.kcal_seuils_pct.vert + EPS) return 'vert';
  if (ecart <= cibles.kcal_seuils_pct.orange + EPS) return 'orange';
  return 'rouge';
}

/** Feu protéines : ≥150 vert · 130–150 orange · <130 rouge. */
export function feuProteines(prot: number, cibles: Cibles): Feu {
  if (prot >= cibles.proteines.vert) return 'vert';
  if (prot >= cibles.proteines.orange) return 'orange';
  return 'rouge';
}

/** Feu calcium : ≥1000 vert · 850–1000 orange · <850 rouge. Enjeu n°1 (ostéopénie). */
export function feuCalcium(calcium: number, cibles: Cibles): Feu {
  if (calcium >= cibles.calcium.vert) return 'vert';
  if (calcium >= cibles.calcium.orange) return 'orange';
  return 'rouge';
}

/**
 * Statut calorique « en clair » pour la jauge de la vue Semaine (FC2).
 * Renvoie une classe (ok/warn/bad) + un mot d'état lisible.
 *  - écart ≤ ±10 % → ok « dans la cible »
 *  - écart ≤ ±20 % → warn « un peu haut / un peu bas »
 *  - au-delà       → bad « au-dessus / en dessous »
 */
export function kcalStatusWord(
  total: number,
  cible: number,
  cibles: Cibles,
): { cls: 'ok' | 'warn' | 'bad'; word: string } {
  if (cible <= 0) return { cls: 'bad', word: 'au-dessus' };
  const diff = (total - cible) / cible;
  const abs = Math.abs(diff);
  if (abs <= cibles.kcal_seuils_pct.vert + EPS) return { cls: 'ok', word: 'dans la cible' };
  if (diff > 0) {
    return abs <= cibles.kcal_seuils_pct.orange + EPS
      ? { cls: 'warn', word: 'un peu haut' }
      : { cls: 'bad', word: 'au-dessus' };
  }
  return abs <= cibles.kcal_seuils_pct.orange + EPS
    ? { cls: 'warn', word: 'un peu bas' }
    : { cls: 'bad', word: 'en dessous' };
}

export interface DayAssessment {
  totals: Macros;
  cibleKcal: number;
  feux: { kcal: Feu; proteines: Feu; calcium: Feu };
}

export function assessDay(
  dayConfig: DayConfig,
  day: DayMenu,
  recipesById: Map<string, Recipe>,
  config: AppConfig,
): DayAssessment {
  const totals = dayTotals(day, recipesById, config);
  const cibleKcal = config.cibles.kcal_par_type[dayConfig.type] ?? dayConfig.cible_kcal;
  return {
    totals,
    cibleKcal,
    feux: {
      kcal: feuKcal(totals.kcal, cibleKcal, config.cibles),
      proteines: feuProteines(totals.prot, config.cibles),
      calcium: feuCalcium(totals.calcium, config.cibles),
    },
  };
}

export interface WeekAverages {
  perDay: Macros;
  feux: { proteines: Feu; calcium: Feu };
}

/** Moyenne de la semaine (par jour), mise en évidence dans la vue Composer. */
export function weekAverages(
  config: AppConfig,
  days: Record<string, DayMenu>,
  recipesById: Map<string, Recipe>,
): WeekAverages {
  const keys = config.jours.map((j) => j.key);
  const n = keys.length || 1;
  let sum: Macros = { ...EMPTY };
  for (const key of keys) {
    const day = days[key] ?? { dejId: null, dinId: null, extras: [] };
    sum = addMacros(sum, dayTotals(day, recipesById, config));
  }
  const perDay: Macros = {
    kcal: Math.round(sum.kcal / n),
    prot: Math.round(sum.prot / n),
    gluc: Math.round(sum.gluc / n),
    lip: Math.round(sum.lip / n),
    calcium: Math.round(sum.calcium / n),
  };
  return {
    perDay,
    feux: {
      proteines: feuProteines(perDay.prot, config.cibles),
      calcium: feuCalcium(perDay.calcium, config.cibles),
    },
  };
}

export function emptyDay(): DayMenu {
  return { dejId: null, dinId: null, extras: [] };
}
