import {
  loadRecipes,
  loadAllWeeks,
  loadDestinataires,
  loadSecurite,
  loadNounou,
  loadApp,
  loadSettings,
  loadAudioKeys,
} from './db';
import { isNative, saveAndShareFile } from './platform';

// Export complet de la donnée locale (invariant « contenu portable » + portabilité
// RGPD + FILET DE SÉCURITÉ Q1 : on exporte AVANT toute première fusion cloud).
// L'audio (binaire) n'est pas embarqué dans le JSON ; on liste ses clés pour mémoire.

export const EXPORT_VERSION = 1;

export interface ManzilExport {
  app: 'manzil';
  exportVersion: number;
  exportedAt: string;
  recipes: unknown[];
  weeks: unknown[];
  destinataires: unknown[];
  securite: unknown[];
  nounou: unknown | null;
  settings: unknown;
  appState: unknown;
  audioKeys: string[]; // clés des notes vocales (binaire non embarqué)
}

/** Rassemble toute la donnée locale structurée en un objet sérialisable. */
export async function collectExport(): Promise<ManzilExport> {
  const [recipes, weeks, destinataires, securite, nounou, settings, appState, audioKeys] =
    await Promise.all([
      loadRecipes(),
      loadAllWeeks(),
      loadDestinataires(),
      loadSecurite(),
      loadNounou(),
      loadSettings(),
      loadApp(),
      loadAudioKeys(),
    ]);
  return {
    app: 'manzil',
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    recipes,
    weeks,
    destinataires,
    securite,
    nounou: nounou ?? null,
    settings,
    appState,
    audioKeys,
  };
}

/** Nom de fichier lisible et daté (sans caractères problématiques). */
export function exportFilename(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `manzil-sauvegarde-${d}.json`;
}

/** Déclenche le téléchargement du JSON d'export — navigateur : `<a download>` ;
 * natif (B2 coquille) : fichier en cache + feuille de partage système, car le
 * `<a download>` est un no-op en WebView (le filet A1 serait absent de l'APK). */
export async function downloadExport(): Promise<void> {
  const data = await collectExport();
  const json = JSON.stringify(data, null, 2);
  if (isNative) {
    await saveAndShareFile(exportFilename(), json);
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
