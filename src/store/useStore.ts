import { create } from 'zustand';
import type { DayType, Recipe, WeekMenu } from '../types';
import { SEED_CONFIG } from '../data';
import {
  ensureSeeded,
  loadRecipes,
  loadWeek,
  saveRecipe,
  saveWeek,
} from '../lib/db';
import { emptyDay } from '../lib/nutrition';

const CURRENT_WEEK_ID = 'current';

function freshWeek(): WeekMenu {
  const days: WeekMenu['days'] = {};
  for (const j of SEED_CONFIG.jours) {
    days[j.key] = emptyDay();
  }
  return { id: CURRENT_WEEK_ID, days };
}

interface State {
  ready: boolean;
  recipes: Recipe[];
  week: WeekMenu;
  init: () => Promise<void>;
  setSlot: (dayKey: string, slot: 'dej' | 'din', recipeId: string | null) => void;
  addExtra: (dayKey: string, recipeId: string) => void;
  removeExtra: (dayKey: string, recipeId: string) => void;
  setDayType: (dayKey: string, type: DayType) => void;
  toggleLock: (dayKey: string, slot: 'dej' | 'din') => void;
  /** Remplace un créneau (non verrouillé) par une recette Validé au hasard. */
  shuffleSlot: (dayKey: string, slot: 'dej' | 'din') => boolean;
  upsertRecipe: (recipe: Recipe) => void;
  setStatut: (id: string, statut: Recipe['statut']) => void;
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  recipes: [],
  week: freshWeek(),

  async init() {
    await ensureSeeded();
    const [recipes, savedWeek] = await Promise.all([
      loadRecipes(),
      loadWeek(CURRENT_WEEK_ID),
    ]);
    // On part d'une semaine fraîche et on fusionne les jours sauvegardés,
    // pour rester robuste si la config des jours évolue.
    const week = freshWeek();
    if (savedWeek) {
      for (const key of Object.keys(week.days)) {
        if (savedWeek.days[key]) week.days[key] = savedWeek.days[key];
      }
    }
    set({ recipes, week, ready: true });
  },

  setSlot(dayKey, slot, recipeId) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      if (slot === 'dej') day.dejId = recipeId;
      else day.dinId = recipeId;
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  addExtra(dayKey, recipeId) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      if (day.extras.includes(recipeId)) return s;
      day.extras = [...day.extras, recipeId];
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  removeExtra(dayKey, recipeId) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      day.extras = day.extras.filter((id) => id !== recipeId);
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  setDayType(dayKey, type) {
    set((s) => {
      const day = { ...s.week.days[dayKey], type };
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  toggleLock(dayKey, slot) {
    set((s) => {
      const day = { ...s.week.days[dayKey] };
      if (slot === 'dej') day.lockDej = !day.lockDej;
      else day.lockDin = !day.lockDin;
      const week = { ...s.week, days: { ...s.week.days, [dayKey]: day } };
      void saveWeek(week);
      return { week };
    });
  },

  shuffleSlot(dayKey, slot) {
    const s = get();
    const day = s.week.days[dayKey];
    const locked = slot === 'dej' ? day.lockDej : day.lockDin;
    if (locked) return false;
    const wantType = slot === 'dej' ? 'Déjeuner' : 'Dîner';
    const current = slot === 'dej' ? day.dejId : day.dinId;
    // ⤧ ne pioche que des recettes Validé du bon type, différentes de l'actuelle.
    const pool = s.recipes.filter(
      (r) => r.type === wantType && r.statut === 'Validé' && r.id !== current,
    );
    if (pool.length === 0) return false;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    get().setSlot(dayKey, slot, pick.id);
    return true;
  },

  upsertRecipe(recipe) {
    set((s) => {
      void saveRecipe(recipe);
      const idx = s.recipes.findIndex((r) => r.id === recipe.id);
      const recipes =
        idx >= 0
          ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [...s.recipes, recipe];
      return { recipes };
    });
  },

  setStatut(id, statut) {
    const recipe = get().recipes.find((r) => r.id === id);
    if (!recipe) return;
    get().upsertRecipe({ ...recipe, statut });
  },
}));
