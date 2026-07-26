import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_SETTINGS,
  normalizeDestinataire,
  normalizeRegles,
  type CuisineSettings,
  type Destinataire,
  type NounouDoc,
  type Recipe,
  type RecipeRole,
  type ReglesFoyer,
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
  // v9 : règles du foyer (lot Cuisine T3) — document unique, clé fixe 'regles'.
  foyer: { key: string; value: ReglesFoyer };
  // v10 : photo du plat (T5/F5.3) — même modèle que `audio` (clé = recipeId).
  images: { key: string; value: RecipeImage };
}

/** Photo du plat d'une recette (F5.3) — JPEG ≤1280px, EXIF déjà retirés. */
export interface RecipeImage {
  recipeId: string;
  blob: Blob;
  mime: string;
  updatedAt: number;
  /** Sauvegarde cloud confirmée (mini-lot destinataires F4) : absent/faux = à
   *  retenter au prochain montage de fiche — jamais de retry aveugle. */
  backedUp?: boolean;
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
const DB_VERSION = 10;
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
        // v9 : règles du foyer (lot Cuisine T3) — document unique, clé fixe 'regles'.
        if (!db.objectStoreNames.contains('foyer')) {
          db.createObjectStore('foyer');
        }
        // v10 : photo du plat (T5/F5.3) — clé = recipeId, comme `audio`.
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'recipeId' });
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

// ── FTUE (F4) — méta LOCALES à l'appareil (le store `meta` n'est pas synchronisé) ──
const FTUE_DONE_KEY = 'ftueDone';
const ROLES_ACTIFS_KEY = 'rolesActifs';
const COMPTE_LIE_KEY = 'compteLie';

/** Identité liée à CET appareil (lot Identité & accès, T1). */
export interface CompteLie {
  userId: string;
  email: string;
  /** Horodatage de la liaison (diagnostic ; jamais affiché). */
  at: number;
}

/**
 * 🔴 LE DRAPEAU DU MUR (T1). Le compte est requis, mais le gate NE PEUT PAS porter
 * sur la session VIVANTE : hors-ligne, `getSession()` renvoie `null` dès que le jeton
 * d'accès a expiré (1 h par défaut) parce que le rafraîchissement ne joint pas le
 * serveur — l'utilisateur serait mis DEHORS avec ses données sur son téléphone, et
 * se reconnecter exige le réseau. On mémorise donc LOCALEMENT qu'un compte a été lié
 * une fois, et c'est CE drapeau qui ouvre l'app.
 *
 * La session vivante reste la condition des seules opérations RÉSEAU (sync,
 * publication, IA) — toutes déjà best-effort. Elle revient d'elle-même au retour du
 * réseau (le jeton de rafraîchissement n'est PAS détruit par un échec réseau).
 *
 * Effacé à la déconnexion et à la suppression de compte : le mur se referme.
 */
export async function loadCompteLie(): Promise<CompteLie | null> {
  const db = await getDB();
  return ((await db.get('meta', COMPTE_LIE_KEY)) as CompteLie | undefined) ?? null;
}

export async function saveCompteLie(userId: string, email: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', { userId, email, at: Date.now() } satisfies CompteLie, COMPTE_LIE_KEY);
}

export async function clearCompteLie(): Promise<void> {
  const db = await getDB();
  await db.delete('meta', COMPTE_LIE_KEY);
}

/**
 * PURGE STRICTEMENT LOCALE des documents synchronisables (lot Identité & accès, T2).
 * Appelée au CHANGEMENT DE FOYER : cet appareil quitte le foyer X pour Y, donc la
 * copie locale de X s'en va et Y sera re-tiré du serveur (le foyer d'arrivée fait foi).
 *
 * 🔴 Cette fonction ne parle QU'À IndexedDB. Les données de X **survivent côté
 * serveur** et se re-tirent si l'appareil y revient : c'est un cache local qu'on vide,
 * jamais une suppression. (Exigence PO — prouvé par `foyer-switch.test.ts`.)
 *
 * Ne touche pas : `meta` (compteLie/ftueDone/rôles), `audio`/`images` (binaires
 * orphelins tolérés, jamais lus sans leur recette), `published` (trace d'envoi locale),
 * ni `app` — qui porte `aiQuota`, miroir d'une vérité SERVEUR, et dont le jumeau du
 * foyer d'arrivée écrase la partie réglages au pull qui suit.
 */
export async function purgeLocalDocs(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('recipes'),
    db.clear('weeks'),
    db.clear('destinataires'),
    db.clear('securite'),
    db.clear('nounou'),
    db.clear('foyer'),
  ]);
  notifyDataChanged();
}

/** Rôles dont la carte est posée sur le hub (activés via FTUE ou « ＋ Une page pour… »). */
export type RoleActif = 'cuisine' | 'nounou';

/** La FTUE a-t-elle déjà été jouée (ou posée rétroactivement) sur CET appareil ? */
export async function loadFtueDone(): Promise<boolean> {
  const db = await getDB();
  return (await db.get('meta', FTUE_DONE_KEY)) === true;
}

export async function saveFtueDone(): Promise<void> {
  const db = await getDB();
  await db.put('meta', true, FTUE_DONE_KEY);
}

export async function loadRolesActifs(): Promise<RoleActif[]> {
  const db = await getDB();
  return ((await db.get('meta', ROLES_ACTIFS_KEY)) as RoleActif[] | undefined) ?? [];
}

export async function saveRolesActifs(roles: RoleActif[]): Promise<void> {
  const db = await getDB();
  await db.put('meta', roles, ROLES_ACTIFS_KEY);
}

/** Cet appareil a-t-il déjà booté AVANT la FTUE ? (critère rétroactif de la migration
 * one-shot — lu par le gate AVANT tout init de store, donc avant que le boot courant
 * ne tamponne `seedVersion` : la course est éliminée par construction.) */
export async function hasBootedBefore(): Promise<boolean> {
  const db = await getDB();
  return (await db.get('meta', SEED_VERSION_KEY)) !== undefined || (await db.get('meta', SEEDED_KEY)) === true;
}

/**
 * F2 (Flow FTUE) : PLUS D'IMPORT AUTOMATIQUE au premier lancement — une bibliothèque
 * neuve démarre VIDE ; l'ancien seed vit dans la collection installable « Fonds de
 * départ » (`data/packs/fonds-de-depart.json`, opt-in via Collections ou FTUE).
 * Le tampon SEED_VERSION et les MIGRATIONS des appareils EXISTANTS (version 1..3 :
 * type→role, complément darija, recettes seed manquantes) restent inchangés.
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDB();

  let version = (await db.get('meta', SEED_VERSION_KEY)) as number | undefined;
  if (version === undefined) {
    version = (await db.get('meta', SEEDED_KEY)) ? 1 : 0;
  }

  if (version === 0) {
    // Premier lancement : RIEN à importer (bibliothèque vide voulue) — on tamponne
    // seulement la version ci-dessous, point de départ des migrations futures.
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
  notifyDataChanged();
}

export async function loadRecipes(): Promise<Recipe[]> {
  const db = await getDB();
  return db.getAll('recipes');
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const db = await getDB();
  await db.put('recipes', recipe);
  notifyDataChanged();
}

/** Suppression RÉELLE (retour device PO, lot UI n°2) — « Écarter » masque,
 * ceci efface. Les pages publiées sont des instantanés : non affectées. */
export async function deleteRecipeDb(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('recipes', id);
  notifyDataChanged();
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
  notifyDataChanged();
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
  // Migration T2 (mini-lot destinataires) : `'ar'` legacy → `'dr'`, réécrit
  // UNE fois en place (idempotent — les lectures suivantes ne touchent rien).
  for (let i = 0; i < all.length; i++) {
    const n = normalizeDestinataire(all[i]);
    if (n !== all[i]) {
      all[i] = n;
      await db.put('destinataires', n);
    }
  }
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveDestinataire(d: Destinataire): Promise<void> {
  const db = await getDB();
  await db.put('destinataires', d);
  notifyDataChanged();
}

export async function deleteDestinataire(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('destinataires', id);
  notifyDataChanged();
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
  notifyDataChanged();
}

export async function deleteSecurite(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('securite', id);
  notifyDataChanged();
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
  notifyDataChanged();
}

// ── Photo du plat (T5/F5.3) — même modèle que l'audio (local d'abord) ─────────

export async function loadImage(recipeId: string): Promise<RecipeImage | undefined> {
  const db = await getDB();
  return db.get('images', recipeId);
}

export async function saveImage(recipeId: string, blob: Blob, mime: string): Promise<void> {
  const db = await getDB();
  // Nouvelle photo → `backedUp` retombe (absent) : elle devra être re-sauvée.
  await db.put('images', { recipeId, blob, mime, updatedAt: Date.now() });
}

/** Marque la photo comme sauvée au cloud (F4) — après confirmation d'upload seulement. */
export async function markImageBackedUp(recipeId: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get('images', recipeId);
  if (rec) await db.put('images', { ...rec, backedUp: true });
}

// ── Règles du foyer (lot Cuisine T3) — document unique, clé fixe 'regles' ─────
// Absent tant que rien n'a été posé (état vide légal, F3.1) : `collectLocalDocs`
// ne pousse alors RIEN (pas de bruit de sync pour un foyer sans restrictions).

const REGLES_KEY = 'regles';

export async function loadFoyerRegles(): Promise<ReglesFoyer | undefined> {
  const db = await getDB();
  const raw = await db.get('foyer', REGLES_KEY);
  if (raw === undefined) return undefined;
  // Migration porte n°1 (lot simplification) : ancien format {allergies, regime}
  // → {nePasManger}. Réécrit UNE fois en place (idempotent).
  const norm = normalizeRegles(raw);
  if (JSON.stringify(norm) !== JSON.stringify(raw)) await db.put('foyer', norm, REGLES_KEY);
  return norm;
}

export async function saveFoyerRegles(r: ReglesFoyer): Promise<void> {
  const db = await getDB();
  await db.put('foyer', r, REGLES_KEY);
  notifyDataChanged();
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
  notifyDataChanged();
}

/**
 * Dernier foyer synchronisé sur cet appareil (FIX revue Q n°5). Remplace le flag
 * `adopted:<foyer>` collant : un foyer ≠ lastFoyer ⇒ contexte neuf ⇒ ré-adoption
 * (avec purge de la méta) au lieu d'un pull filtré par le curseur d'un autre foyer.
 */
export async function loadLastFoyer(): Promise<string | null> {
  const db = await getDB();
  return ((await db.get('meta', 'lastFoyer')) as string | undefined) ?? null;
}

export async function saveLastFoyer(foyerId: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', foyerId, 'lastFoyer');
}

/**
 * Purge l'état de sync local (méta doc, curseurs, lastFoyer, anciens flags).
 * Utilisée au changement de foyer (ré-adoption propre) et à la suppression de
 * compte (FIX revue Q n°10 : pas d'état de sync fantôme après suppression).
 */
export async function clearSyncState(): Promise<void> {
  const db = await getDB();
  await db.clear('syncmeta');
  const keys = (await db.getAllKeys('meta')) as string[];
  for (const k of keys) {
    if (k === 'lastFoyer' || k === SYNC_CURSOR_KEY || k.startsWith('syncCursor:') || k.startsWith('adopted:')) {
      await db.delete('meta', k);
    }
  }
}

/** Suppression locale générique par id (utilisée par la sync sur tombstone distant). */
export async function deleteById(
  store: 'recipes' | 'weeks' | 'destinataires' | 'securite',
  id: string,
): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
  notifyDataChanged();
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

/** Curseur de pull PAR FOYER (FIX revue Q n°5 : plus jamais partagé entre foyers). */
export async function loadSyncCursor(foyerId: string): Promise<string | null> {
  const db = await getDB();
  return ((await db.get('meta', 'syncCursor:' + foyerId)) as string | undefined) ?? null;
}

export async function saveSyncCursor(foyerId: string, cursor: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', cursor, 'syncCursor:' + foyerId);
}

// ── Signal de changement de données (FIX revue Q n°6) ───────────────────────
// Tous les stores (cuisine, nounou, sécurité, destinataires, réglages) notifient
// ici : le moteur de sync s'y abonne pour déclencher le push débouncé, quel que
// soit le store — plus de dépendance au seul store zustand cuisine.
type DataListener = () => void;
const dataListeners = new Set<DataListener>();

export function onDataChanged(l: DataListener): () => void {
  dataListeners.add(l);
  return () => dataListeners.delete(l);
}

function notifyDataChanged(): void {
  for (const l of dataListeners) l();
}
