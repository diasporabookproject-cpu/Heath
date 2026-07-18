import { getSupabase } from '../supabase';
import { currentFoyerId } from '../auth';
import { saveImage } from '../db';

// Photo du plat (T5/F5.3) — sauvegarde MIROIR du pattern audio (S3′/0003) :
// bucket PRIVÉ par foyer (`foyer-images`, objets `foyer_id/recipes/<recipeId>.jpg`,
// RLS = membres du foyer — migration 0010). JAMAIS bloquant : hors-ligne ou bucket
// absent, la photo vit en local (IDB `images`) comme avant. Restauration
// PARESSEUSE à l'ouverture d'une fiche sans photo locale.
// (Copie publique au partage : hors périmètre T5 — la photo n'apparaît que sur
// la fiche admin pour l'instant ; tracé au DEVLOG.)

const BUCKET = 'foyer-images';
const path = (foyer: string, recipeId: string) => `${foyer}/recipes/${recipeId}.jpg`;

/** Téléverse la photo du plat dans le bucket privé du foyer (fire-and-forget). */
export async function backupImage(recipeId: string, blob: Blob, mime: string): Promise<void> {
  missing.delete(recipeId);
  try {
    const supa = getSupabase();
    if (!supa) return;
    const foyer = await currentFoyerId();
    if (!foyer) return;
    await supa.storage.from(BUCKET).upload(path(foyer, recipeId), blob, {
      contentType: mime || 'image/jpeg',
      upsert: true,
    });
  } catch {
    /* best-effort : ne bloque jamais l'enregistrement local */
  }
}

// Cache négatif de session (même leçon que l'audio — pas de re-téléchargement
// raté à chaque montage de fiche).
const missing = new Set<string>();

/** Restaure une photo manquante localement depuis le bucket (paresseux). */
export async function restoreImage(recipeId: string): Promise<Blob | null> {
  if (missing.has(recipeId)) return null;
  try {
    const supa = getSupabase();
    if (!supa) return null;
    const foyer = await currentFoyerId();
    if (!foyer) return null;
    const { data, error } = await supa.storage.from(BUCKET).download(path(foyer, recipeId));
    if (error || !data) {
      missing.add(recipeId);
      return null;
    }
    await saveImage(recipeId, data, data.type || 'image/jpeg');
    return data;
  } catch {
    return null;
  }
}
