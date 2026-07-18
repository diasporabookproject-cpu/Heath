import {
  loadRecipes,
  loadAllWeeks,
  loadDestinataires,
  loadSecurite,
  loadNounou,
  loadFoyerRegles,
  loadApp,
  loadSettings,
  saveRecipe,
  saveWeek,
  saveDestinataire,
  saveSecurite,
  saveNounou,
  saveFoyerRegles,
  saveApp,
  saveSettings,
  deleteById,
} from '../db';
import type { AppState } from '../db';
import { normalizeDestinataire, type Recipe, type WeekMenu, type Destinataire, type SecuriteFiche, type NounouDoc, type CuisineSettings, type ReglesFoyer } from '../../types';
import type { LocalDoc, SyncStore } from './plan';

// Correspondance stores IndexedDB ↔ table `docs`. Par ligne pour
// recipes/weeks/destinataires/securite ; blob unique pour nounou/app.
// G3 : `aiQuota` NE transite PAS par la sync (vérité serveur `ai_usage`).

const APP_DOC_ID = 'app';
const NOUNOU_DOC_ID = 'doc';
const REGLES_DOC_ID = 'regles';

/** Retire du payload `app` ce qui ne doit pas se synchroniser (quota IA). */
function appForSync(app: AppState): AppState {
  const rest = { ...app };
  delete rest.aiQuota;
  return rest;
}

/** Rassemble tous les documents locaux synchronisables. */
export async function collectLocalDocs(): Promise<LocalDoc[]> {
  const [recipes, weeks, dest, secu, nounou, regles, app, settings] = await Promise.all([
    loadRecipes(),
    loadAllWeeks(),
    loadDestinataires(),
    loadSecurite(),
    loadNounou(),
    loadFoyerRegles(),
    loadApp(),
    loadSettings(),
  ]);
  const docs: LocalDoc[] = [];
  for (const r of recipes) docs.push({ store: 'recipes', docId: r.id, payload: r });
  for (const w of weeks) docs.push({ store: 'weeks', docId: w.id, payload: w });
  for (const d of dest) docs.push({ store: 'destinataires', docId: d.id, payload: d });
  for (const f of secu) docs.push({ store: 'securite', docId: f.id, payload: f });
  if (nounou) docs.push({ store: 'nounou', docId: NOUNOU_DOC_ID, payload: nounou });
  // Règles du foyer (T3) : blob unique, poussé seulement une fois posé (état
  // vide légal = pas de doc = pas de bruit).
  if (regles) docs.push({ store: 'foyer', docId: REGLES_DOC_ID, payload: regles });
  docs.push({ store: 'app', docId: APP_DOC_ID, payload: appForSync(app) });
  // Réglages Cuisine (objectif kcal, personnes) — périmètre D4 « réglages ».
  docs.push({ store: 'settings', docId: 'settings', payload: settings });
  return docs;
}

/** Écrit un document distant dans le bon store local. */
export async function applyRemote(store: SyncStore, _docId: string, payload: unknown): Promise<void> {
  switch (store) {
    case 'recipes':
      return saveRecipe(payload as Recipe);
    case 'weeks':
      return saveWeek(payload as WeekMenu);
    case 'destinataires':
      // T2 : un appareil PAS à jour peut encore pousser `langue: 'ar'` (= darija
      // legacy) — normalisé à l'arrivée, même règle que la lecture IDB.
      return saveDestinataire(normalizeDestinataire(payload as Destinataire));
    case 'securite':
      return saveSecurite(payload as SecuriteFiche);
    case 'nounou':
      return saveNounou(payload as NounouDoc);
    case 'foyer':
      return saveFoyerRegles(payload as ReglesFoyer);
    case 'settings':
      return saveSettings(payload as CuisineSettings);
    case 'app': {
      // G3 : on préserve l'aiQuota LOCAL (vérité serveur ailleurs), on n'adopte
      // que le reste des réglages (rappels) venus du cloud.
      const local = await loadApp();
      const remote = (payload ?? {}) as AppState;
      return saveApp({ ...remote, aiQuota: local.aiQuota });
    }
  }
}

/** Supprime localement un document (tombstone distant appliqué). */
export async function applyDelete(store: SyncStore, docId: string): Promise<void> {
  if (store === 'recipes' || store === 'weeks' || store === 'destinataires' || store === 'securite') {
    return deleteById(store, docId);
  }
  // nounou/foyer/app : blobs toujours présents une fois créés — pas de suppression par sync en v1.
}
