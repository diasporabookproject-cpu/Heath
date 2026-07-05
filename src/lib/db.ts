import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_SETTINGS,
  type CuisineSettings,
  type Destinataire,
  type NounouDoc,
  type Recipe,
  type RecipeRole,
  type SecuriteFiche,
  type WeekMenu,
} from '../types';
import { SEED_RECIPES } from '../data';
import type { AiQuota } from './quota';
import type { DocMeta, MetaIndex } from './sync/plan';

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
  destinataires: { key: string; value: Destinataire };
  securite: { key: string; value: SecuriteFiche };
  nounou: { key: string; value: NounouDoc };
  published: { key: string; value: PublishRecord };
  app: { key: string; value: AppState };
  // v8 : méta de sync par document (hash + horodatage serveur du dernier échange).
  syncmeta: { key: string; value: DocMeta };
}

/** Trace locale du dernier envoi par destinataire (état « à envoyer », L1-4). */
export interface PublishRecord {
  token: string;
  sig: string;
  at: string;
}

/**
 * État applicatif transverse (L3) — réglages qui ne sont ni des recettes, ni du
 * menu, ni un destinataire : quota IA (L3-2), rappels d'envoi (L3-5). Store dédié
 * `app` (clé fixe 'app') plutôt que d'étendre `CuisineSettings` (transverse aux rôles).
 */
export interface AppState {
  aiQuota?: AiQuota;
  /** Rappels d'envoi par rôle (L3-5). */
  rappels?: { cuisine?: Rappel; nounou?: Rappel };
}

export interface Rappel {
  day: number; // 0 = lundi … 6 = dimanche
  time: string; // 'HH:MM'
}

const DB_NAME = 'menu-semaine';
const DB_VERSION = 8;
const APP_KEY = 'app';
const SYNC_CURSOR_KEY = 'syncCursor';

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
        // v3 : destinataires (personnel de maison) — concept transverse.
        if (!db.objectStoreNames.contains('destinataires')) {
          db.createObjectStore('destinataires', { keyPath: 'id' });
        }
        // v4 : référentiel Sécurité (consignes du foyer).
        if (!db.objectStoreNames.contains('securite')) {
          db.createObjectStore('securite', { keyPath: 'id' });
        }
        // v5 : document Nounou unique (modèle en couches, clé fixe 'doc').
        if (!db.objectStoreNames.contains('nounou')) {
          db.createObjectStore('nounou');
        }
        // v6 : trace du dernier envoi par destinataire (état de transmission).
        if (!db.objectStoreNames.contains('published')) {
          db.createObjectStore('published', { keyPath: 'token' });
        }
        // v7 : état applicatif transverse (quota IA, rappels) — clé fixe 'app'.
        if (!db.objectStoreNames.contains('app')) {
          db.createObjectStore('app');
        }
        // v8 : méta de sync par document (clé = `${store}:${docId}`, hors ligne).
        if (!db.objectStoreNames.contains('syncmeta')) {
          db.createObjectStore('syncmeta');
        }
      },
    });
  }
  return dbPromise;
}

const SEEDED_KEY = 'seeded';
const SEED_VERSION_KEY = 'seedVersion';
const SETTINGS_KEY = 'settings';
// 1 = jeu initial · 2 = darija · 3 = +2 recettes · 4 = modèle v2 (rôles + petitdej/acc)
const SEED_VERSION = 4;

/**
 * Au premier lancement : importe le jeu de données de départ.
 * Aux lancements suivants : applique les migrations sans écraser les recettes
 * ajoutées/modifiées par l'utilisateur. v4 : migration vers le modèle v2
 * (Recipe.type → Recipe.role ; ajout petit-déj/accompagnements ; reset semaines).
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();

  let version = (await db.get('meta', SEED_VERSION_KEY)) as number | undefined;
  if (version === undefined) {
    version = (await db.get('meta', SEEDED_KEY)) ? 1 : 0;
  }

  if (version === 0) {
    const tx = db.transaction('recipes', 'readwrite');
    for (const r of SEED_RECIPES) await tx.store.put(r);
    await tx.done;
  } else if (version < SEED_VERSION) {
    // a) Migrer les recettes existantes (type → role) si besoin.
    if (version < 4) {
      const tx = db.transaction('recipes', 'readwrite');
      let cursor = await tx.store.openCursor();
      while (cursor) {
        const r = cursor.value as Recipe & { role?: RecipeRole; type?: string; jour?: string };
        if (!r.role) {
          r.role = r.type === 'Coupe-faim' ? 'entree' : 'plat';
          if (r.fav === undefined) r.fav = false;
          delete r.type;
          delete r.jour;
          await cursor.update(r);
        }
        cursor = await cursor.continue();
      }
      await tx.done;
      // Le modèle de semaine change (3 repas + composants) → repartir propre.
      await db.clear('weeks');
    }
    // b) Ajouter les recettes du seed absentes + compléter la darija manquante.
    const tx2 = db.transaction('recipes', 'readwrite');
    for (const seed of SEED_RECIPES) {
      const existing = await tx2.store.get(seed.id);
      if (!existing) {
        await tx2.store.put(seed);
      } else if (!existing.nom_ar && (seed.nom_ar || seed.ingredients_ar)) {
        await tx2.store.put({ ...existing, nom_ar: seed.nom_ar, ingredients_ar: seed.ingredients_ar });
      }
    }
    await tx2.done;
  }

  if (version < SEED_VERSION) {
    await db.put('meta', true, SEEDED_KEY);
    await db.put('meta', SEED_VERSION, SEED_VERSION_KEY);
  }
}

/** Réglages Cuisine (objectif individuel + nombre de personnes). */
export async function loadSettings(): Promise<CuisineSettings> {
  const db = await getDB();
  const s = (await db.get('meta', SETTINGS_KEY)) as Partial<CuisineSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: CuisineSettings): Promise<void> {
  const db = await getDB();
  await db.put('meta', s, SETTINGS_KEY);
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

/** Toutes les semaines stockées (pour « copier une semaine »). */
export async function loadAllWeeks(): Promise<WeekMenu[]> {
  const db = await getDB();
  return db.getAll('weeks');
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

// ── Destinataires (personnel de maison) ─────────────────────────────────────

export async function loadDestinataires(): Promise<Destinataire[]> {
  const db = await getDB();
  const all = await db.getAll('destinataires');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveDestinataire(d: Destinataire): Promise<void> {
  const db = await getDB();
  await db.put('destinataires', d);
}

export async function deleteDestinataire(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('destinataires', id);
}

// ── Référentiel Sécurité ─────────────────────────────────────────────────────

export async function loadSecurite(): Promise<SecuriteFiche[]> {
  const db = await getDB();
  const all = await db.getAll('securite');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveSecurite(f: SecuriteFiche): Promise<void> {
  const db = await getDB();
  await db.put('securite', f);
}

export async function deleteSecurite(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('securite', id);
}

// ── Document Nounou (page par rôle, modèle en couches) ───────────────────────

const NOUNOU_KEY = 'doc';

export async function loadNounou(): Promise<NounouDoc | undefined> {
  const db = await getDB();
  return (await db.get('nounou', NOUNOU_KEY)) as NounouDoc | undefined;
}

export async function saveNounou(doc: NounouDoc): Promise<void> {
  const db = await getDB();
  await db.put('nounou', doc, NOUNOU_KEY);
}

// ── État de transmission (dernier envoi par destinataire, L1-4) ──────────────

export async function loadPublished(): Promise<Record<string, PublishRecord>> {
  const db = await getDB();
  const all = await db.getAll('published');
  const map: Record<string, PublishRecord> = {};
  for (const r of all) map[r.token] = r;
  return map;
}

export async function recordPublished(token: string, sig: string): Promise<void> {
  const db = await getDB();
  await db.put('published', { token, sig, at: new Date().toISOString() });
}

/** État applicatif transverse (quota IA, rappels). */
export async function loadApp(): Promise<AppState> {
  const db = await getDB();
  return (await db.get('app', APP_KEY)) ?? {};
}

export async function saveApp(state: AppState): Promise<void> {
  const db = await getDB();
  await db.put('app', state, APP_KEY);
}

/** Drapeau « adoption faite » pour un foyer (évite de re-fusionner à chaque login). */
export async function isFoyerAdopted(foyerId: string): Promise<boolean> {
  const db = await getDB();
  return !!(await db.get('meta', 'adopted:' + foyerId));
}

export async function markFoyerAdopted(foyerId: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', true, 'adopted:' + foyerId);
}

/** Suppression locale générique par id (utilisée par la sync sur tombstone distant). */
export async function deleteById(
  store: 'recipes' | 'weeks' | 'destinataires' | 'securite',
  id: string,
): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
}

// ── Méta de sync (v8) ────────────────────────────────────────────────────────
/** Toute la méta de sync, indexée par `${store}:${docId}`. */
export async function loadAllSyncMeta(): Promise<MetaIndex> {
  const db = await getDB();
  const keys = (await db.getAllKeys('syncmeta')) as string[];
  const vals = await db.getAll('syncmeta');
  const out: MetaIndex = {};
  keys.forEach((k, i) => (out[k] = vals[i]));
  return out;
}

export async function putSyncMeta(key: string, meta: DocMeta): Promise<void> {
  const db = await getDB();
  await db.put('syncmeta', meta, key);
}

export async function delSyncMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncmeta', key);
}

/** Curseur de pull (max updated_at déjà rapatrié) — stocké dans `meta`. */
export async function loadSyncCursor(): Promise<string | null> {
  const db = await getDB();
  return ((await db.get('meta', SYNC_CURSOR_KEY)) as string | undefined) ?? null;
}

export async function saveSyncCursor(cursor: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', cursor, SYNC_CURSOR_KEY);
}
