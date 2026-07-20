import { create } from 'zustand';
import type { AccRef, CuisineSettings, DayMenu, MealKey, Recipe, ReglesFoyer, WeekMenu } from '../types';
import { DEFAULT_SETTINGS, EMPTY_REGLES } from '../types';
import { SEED_CONFIG } from '../data';
import { deleteRecipeDb,
  ensureSeeded,
  loadApp,
  loadFoyerRegles,
  loadRecipes,
  loadSettings,
  loadWeek,
  saveApp,
  saveFoyerRegles,
  saveRecipe,
  saveSettings,
  saveWeek,
  type AppState,
  type Rappel,
} from '../lib/db';
import { consume, currentMonth, normalizeQuota } from '../lib/quota';
import { emptyDay } from '../lib/menu';
import { weekId } from '../cuisine/dates';

function freshWeek(id: string): WeekMenu {
  const days: WeekMenu['days'] = {};
  for (const j of SEED_CONFIG.jours) days[j.key] = emptyDay();
  return { id, days };
}

/** Charge la semaine d'un id (fusion des jours v2 valides), sinon vide. */
async function weekFor(id: string): Promise<WeekMenu> {
  const saved = await loadWeek(id);
  const week = freshWeek(id);
  if (saved) {
    for (const key of Object.keys(week.days)) {
      if (isV2Day(saved.days[key])) week.days[key] = saved.days[key];
    }
  }
  return week;
}

/** Une journée chargée est-elle au nouveau format (3 repas) ? */
function isV2Day(d: unknown): boolean {
  return !!d && typeof d === 'object' && 'petitdej' in (d as object);
}

type Slot = 'plat' | 'entree' | 'acc';

interface State {
  ready: boolean;
  recipes: Recipe[];
  week: WeekMenu;
  weekOffset: number;
  settings: CuisineSettings;
  /** T3 (F3.1) — règles du foyer (allergies, halal, régime). EMPTY_REGLES tant
   * que rien n'est posé (le doc IDB n'existe alors pas → rien ne se synchronise). */
  regles: ReglesFoyer;
  app: AppState;
  init: () => Promise<void>;
  /** Recharge les données depuis IndexedDB (après un pull de sync), sans reset de nav. */
  refresh: () => Promise<void>;
  navWeek: (delta: number) => Promise<void>;
  /** Consomme une génération IA (porte ③) ; borné à la limite mensuelle. */
  consumeAi: () => void;
  /** Règle (ou retire) le rappel d'envoi d'un rôle (L3-5). */
  setRappel: (kind: 'cuisine' | 'nounou', r: Rappel | null) => void;
  /** Copie en profondeur les jours d'une autre semaine dans la semaine courante. */
  copyWeekInto: (srcDays: WeekMenu['days']) => void;
  /** F7.2 : copie en profondeur UN jour (journée précédente) dans le jour cible. */
  copyDayInto: (targetKey: string, srcDay: DayMenu) => void;
  setComponent: (dayKey: string, meal: MealKey, slot: Slot, value: string | AccRef | null) => void;
  setAccQty: (dayKey: string, meal: MealKey, deltaG: number) => void;
  setPersons: (n: number) => void;
  setRegles: (r: ReglesFoyer) => void;
  upsertRecipe: (recipe: Recipe) => void;
  /** Supprime VRAIMENT (IDB + état) et vide les créneaux de la semaine courante qui la référencent. */
  deleteRecipe: (id: string) => void;
  setStatut: (id: string, statut: Recipe['statut']) => void;
  validateRecipe: (id: string) => void;
  toggleFav: (id: string) => void;
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  recipes: [],
  week: freshWeek(weekId(0)),
  weekOffset: 0,
  settings: DEFAULT_SETTINGS,
  regles: EMPTY_REGLES,
  app: {},

  async init() {
    await ensureSeeded();
    const [recipes, week, settings, regles, loadedApp] = await Promise.all([
      loadRecipes(),
      weekFor(weekId(0)),
      loadSettings(),
      loadFoyerRegles(),
      loadApp(),
    ]);
    // Normalise le quota IA pour le mois courant (reset au changement de mois).
    const aiQuota = normalizeQuota(loadedApp.aiQuota, currentMonth());
    const app: AppState = { ...loadedApp, aiQuota };
    if (loadedApp.aiQuota?.month !== aiQuota.month) void saveApp(app);
    set({ recipes, week, weekOffset: 0, settings, regles: regles ?? EMPTY_REGLES, app, ready: true });
  },

  async refresh() {
    const [recipes, week, settings, regles, loadedApp] = await Promise.all([
      loadRecipes(),
      weekFor(weekId(get().weekOffset)),
      loadSettings(),
      loadFoyerRegles(),
      loadApp(),
    ]);
    const aiQuota = normalizeQuota(loadedApp.aiQuota, currentMonth());
    set({ recipes, week, settings, regles: regles ?? EMPTY_REGLES, app: { ...loadedApp, aiQuota } });
  },

  consumeAi() {
    const cur = get().app;
    const aiQuota = consume(normalizeQuota(cur.aiQuota, currentMonth()));
    const app: AppState = { ...cur, aiQuota };
    void saveApp(app);
    set({ app });
  },

  setRappel(kind, r) {
    const cur = get().app;
    const rappels = { ...cur.rappels };
    if (r) rappels[kind] = r;
    else delete rappels[kind];
    const app: AppState = { ...cur, rappels };
    void saveApp(app);
    set({ app });
  },

  async navWeek(delta) {
    const offset = get().weekOffset + delta;
    const week = await weekFor(weekId(offset));
    set({ weekOffset: offset, week });
  },

  copyWeekInto(srcDays) {
    set((s) => {
      const week = freshWeek(s.week.id);
      for (const key of Object.keys(week.days)) {
        if (isV2Day(srcDays[key])) week.days[key] = JSON.parse(JSON.stringify(srcDays[key]));
      }
      void saveWeek(week);
      return { week };
    });
  },

  // F7.2 (amendement ① → retour PO n°4 : la SOURCE se CHOISIT) : copie
  // PROFONDE d'un jour dans le jour cible. Les ids ORPHELINS (recette
  // supprimée depuis — n°2) sont filtrés à la copie : jamais de créneau fantôme.
  copyDayInto(targetKey, srcDay) {
    set((s) => {
      const known = new Set(s.recipes.map((r) => r.id));
      const day: DayMenu = JSON.parse(JSON.stringify(srcDay));
      for (const k of Object.keys(day) as (keyof DayMenu)[]) {
        const m = day[k];
        if (!m) continue;
        if (m.plat && !known.has(m.plat)) m.plat = null;
        if ('entree' in m && m.entree && !known.has(m.entree)) m.entree = null;
        if ('acc' in m && m.acc && !known.has(m.acc.id)) m.acc = null;
      }
      const week = { ...s.week, days: { ...s.week.days, [targetKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  deleteRecipe(id) {
    set((s) => {
      void deleteRecipeDb(id);
      // Purge de la semaine COURANTE (les semaines archivées gardent l'id ;
      // copyDayInto filtre les orphelins à la relecture).
      let touched = false;
      const days = { ...s.week.days };
      for (const dk of Object.keys(days)) {
        const day = { ...days[dk] };
        for (const mk of Object.keys(day) as (keyof DayMenu)[]) {
          const m0 = day[mk];
          if (!m0) continue;
          const m = { ...m0 };
          let hit = false;
          if (m.plat === id) { m.plat = null; hit = true; }
          if ('entree' in m && m.entree === id) { m.entree = null; hit = true; }
          if ('acc' in m && m.acc?.id === id) { m.acc = null; hit = true; }
          if (hit) { day[mk] = m; touched = true; }
        }
        days[dk] = day;
      }
      const week = touched ? { ...s.week, days } : s.week;
      if (touched) void saveWeek(week);
      return { recipes: s.recipes.filter((r) => r.id !== id), week };
    });
  },

  setComponent(dayKey, meal, slot, value) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      // Garde sync : un jour stocké/synchronisé AVANT T3 n'a pas la clé `gouter`.
      const m = { plat: null, ...day[meal] };
      if (slot === 'acc') m.acc = value as AccRef | null;
      else if (slot === 'entree') m.entree = value as string | null;
      else m.plat = value as string | null;
      day[meal] = m;
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  setAccQty(dayKey, meal, deltaG) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      const m = { plat: null, ...day[meal] };
      if (!m.acc) return s;
      m.acc = { ...m.acc, g: Math.max(25, m.acc.g + deltaG) };
      day[meal] = m;
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },


  setPersons(n) {
    set((s) => {
      const settings = { ...s.settings, persons: Math.max(1, Math.min(12, n)) };
      void saveSettings(settings);
      return { settings };
    });
  },

  setRegles(r) {
    void saveFoyerRegles(r);
    set({ regles: r });
  },

  upsertRecipe(recipe) {
    set((s) => {
      void saveRecipe(recipe);
      const idx = s.recipes.findIndex((r) => r.id === recipe.id);
      const recipes =
        idx >= 0 ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...s.recipes, recipe];
      return { recipes };
    });
  },

  setStatut(id, statut) {
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    get().upsertRecipe({ ...recipe, statut });
  },

  validateRecipe(id) {
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    get().upsertRecipe({ ...recipe, statut: 'Validé' });
  },

  toggleFav(id) {
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    get().upsertRecipe({ ...recipe, fav: !recipe.fav });
  },
}));
