import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Recipe, WeekMenu } from '../types';
import { SEED_RECIPES } from '../data';

// IndexedDB = source de vérité locale (offline-first). La synchro Supabase
// (étape suivante) viendra se réconcilier par-dessus ce store.

interface MenuDB extends DBSchema {
  recipes: { key: string; value: Recipe };
  weeks: { key: string; value: WeekMenu };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'menu-semaine';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MenuDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MenuDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MenuDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('recipes')) {
          db.createObjectStore('recipes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('weeks')) {
          db.createObjectStore('weeks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

const SEEDED_KEY = 'seeded';

/** Au premier lancement, on importe le jeu de données de départ. */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();
  const already = await db.get('meta', SEEDED_KEY);
  if (already) return;
  const tx = db.transaction('recipes', 'readwrite');
  for (const r of SEED_RECIPES) {
    await tx.store.put(r);
  }
  await tx.done;
  await db.put('meta', true, SEEDED_KEY);
}

export async function loadRecipes(): Promise<Recipe[]> {
  const db = await getDB();
  return db.getAll('recipes');
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const db = await getDB();
  await db.put('recipes', recipe);
}

export async function loadWeek(id: string): Promise<WeekMenu | undefined> {
  const db = await getDB();
  return db.get('weeks', id);
}

export async function saveWeek(week: WeekMenu): Promise<void> {
  const db = await getDB();
  await db.put('weeks', week);
}
