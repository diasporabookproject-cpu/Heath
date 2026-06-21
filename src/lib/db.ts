import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Recipe, WeekMenu } from '../types';
import { SEED_RECIPES } from '../data';

// IndexedDB = source de vérité locale (offline-first). La synchro Supabase
// (étape suivante) viendra se réconcilier par-dessus ce store.

interface AudioNote {
  recipeId: string;
  blob: Blob;
  mime: string;
  updatedAt: number;
}

interface MenuDB extends DBSchema {
  recipes: { key: string; value: Recipe };
  weeks: { key: string; value: WeekMenu };
  meta: { key: string; value: unknown };
  audio: { key: string; value: AudioNote };
}

const DB_NAME = 'menu-semaine';
const DB_VERSION = 2;

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
        // v2 : notes vocales par recette (clé = id de recette).
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'recipeId' });
        }
      },
    });
  }
  return dbPromise;
}

const SEEDED_KEY = 'seeded';
const SEED_VERSION_KEY = 'seedVersion';
// 1 = jeu initial · 2 = traductions darija · 3 = +2 recettes (DEJ-09, DIN-10)
const SEED_VERSION = 3;

/**
 * Au premier lancement : importe le jeu de données de départ.
 * Aux lancements suivants : applique les migrations (ex. backfill darija)
 * sans écraser les recettes ajoutées/modifiées par l'utilisateur.
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();

  let version = (await db.get('meta', SEED_VERSION_KEY)) as number | undefined;
  if (version === undefined) {
    // Compat : les anciennes installations n'avaient que le flag booléen.
    version = (await db.get('meta', SEEDED_KEY)) ? 1 : 0;
  }

  if (version === 0) {
    // Installation neuve : on importe tout.
    const tx = db.transaction('recipes', 'readwrite');
    for (const r of SEED_RECIPES) await tx.store.put(r);
    await tx.done;
  } else if (version < SEED_VERSION) {
    // Migration v1 -> v2 : on complète les champs darija manquants,
    // sans toucher au statut ni aux champs déjà personnalisés.
    const tx = db.transaction('recipes', 'readwrite');
    for (const seed of SEED_RECIPES) {
      const existing = await tx.store.get(seed.id);
      if (!existing) {
        await tx.store.put(seed); // recette du seed absente : on l'ajoute
      } else if (!existing.nom_ar && (seed.nom_ar || seed.ingredients_ar)) {
        await tx.store.put({
          ...existing,
          nom_ar: seed.nom_ar,
          ingredients_ar: seed.ingredients_ar,
        });
      }
    }
    await tx.done;
  }

  if (version < SEED_VERSION) {
    await db.put('meta', true, SEEDED_KEY);
    await db.put('meta', SEED_VERSION, SEED_VERSION_KEY);
  }
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

// ── Notes vocales (locales pour l'instant ; synchro Supabase à venir) ────────

export async function saveAudio(recipeId: string, blob: Blob, mime: string): Promise<void> {
  const db = await getDB();
  await db.put('audio', { recipeId, blob, mime, updatedAt: Date.now() });
}

export async function loadAudio(recipeId: string): Promise<Blob | undefined> {
  const db = await getDB();
  const rec = await db.get('audio', recipeId);
  return rec?.blob;
}

export async function deleteAudio(recipeId: string): Promise<void> {
  const db = await getDB();
  await db.delete('audio', recipeId);
}

/** Ids des recettes qui ont une note vocale (pour afficher un indicateur). */
export async function loadAudioKeys(): Promise<string[]> {
  const db = await getDB();
  return (await db.getAllKeys('audio')) as string[];
}
