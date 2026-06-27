import { create } from 'zustand';
import type { AccRef, CuisineSettings, MealKey, Recipe, WeekMenu } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { SEED_CONFIG } from '../data';
import {
  ensureSeeded,
  loadRecipes,
  loadSettings,
  loadWeek,
  saveRecipe,
  saveSettings,
  saveWeek,
} from '../lib/db';
import { emptyDay } from '../lib/nutrition';
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
  init: () => Promise<void>;
  navWeek: (delta: number) => Promise<void>;
  /** Copie en profondeur les jours d'une autre semaine dans la semaine courante. */
  copyWeekInto: (srcDays: WeekMenu['days']) => void;
  setComponent: (dayKey: string, meal: MealKey, slot: Slot, value: string | AccRef | null) => void;
  setAccQty: (dayKey: string, meal: MealKey, deltaG: number) => void;
  setObjective: (n: number) => void;
  setPersons: (n: number) => void;
  upsertRecipe: (recipe: Recipe) => void;
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

  async init() {
    await ensureSeeded();
    const [recipes, week, settings] = await Promise.all([
      loadRecipes(),
      weekFor(weekId(0)),
      loadSettings(),
    ]);
    set({ recipes, week, weekOffset: 0, settings, ready: true });
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

  setComponent(dayKey, meal, slot, value) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      const m = { ...day[meal] };
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
      const m = { ...day[meal] };
      if (!m.acc) return s;
      m.acc = { ...m.acc, g: Math.max(25, m.acc.g + deltaG) };
      day[meal] = m;
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  setObjective(n) {
    set((s) => {
      const settings = { ...s.settings, objective: Math.max(1000, Math.min(3500, n)) };
      void saveSettings(settings);
      return { settings };
    });
  },

  setPersons(n) {
    set((s) => {
      const settings = { ...s.settings, persons: Math.max(1, Math.min(12, n)) };
      void saveSettings(settings);
      return { settings };
    });
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
    get().upsertRecipe({ ...recipe, statut: 'Validé', macros_estimees: false });
  },

  toggleFav(id) {
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    get().upsertRecipe({ ...recipe, fav: !recipe.fav });
  },
}));
