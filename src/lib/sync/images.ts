import { getSupabase } from '../supabase';
import { currentFoyerId } from '../auth';
import { loadImage, markImageBackedUp, saveImage } from '../db';
import { isNotFound } from './storage-err';

// Photo du plat (T5/F5.3) — sauvegarde MIROIR du pattern audio (S3′/0003) :
// bucket PRIVÉ par foyer (`foyer-images`, objets `foyer_id/recipes/<recipeId>.jpg`,
// RLS = membres du foyer — migration 0010). JAMAIS bloquant : hors-ligne ou bucket
// absent, la photo vit en local (IDB `images`) comme avant. Restauration
// PARESSEUSE à l'ouverture d'une fiche sans photo locale.
// F4 (mini-lot destinataires) : l'échec d'upload n'est plus perdu — un état
// `backedUp?` sur l'enregistrement local, posé à la CONFIRMATION d'upload ;
// `retryImageBackup` retente au montage de fiche UNIQUEMENT si l'état est faux
// (jamais de retry aveugle : il ré-uploaderait tout à chaque parcours de fiches).
// (Copie publique au partage : hors périmètre T5 — la photo n'apparaît que sur
// la fiche admin pour l'instant ; tracé au DEVLOG.)

const BUCKET = 'foyer-images';
const path = (foyer: string, recipeId: string) => `${foyer}/recipes/${recipeId}.jpg`;

/** Téléverse la photo du plat dans le bucket privé du foyer (best-effort, jamais bloquant). */
export async function backupImage(recipeId: string, blob: Blob, mime: string): Promise<void> {
  missing.delete(recipeId);
  try {
    const supa = getSupabase();
    if (!supa) return;
    const foyer = await currentFoyerId();
    if (!foyer) return;
    const { error } = await supa.storage.from(BUCKET).upload(path(foyer, recipeId), blob, {
      contentType: mime || 'image/jpeg',
      upsert: true,
    });
    if (!error) await markImageBackedUp(recipeId);
  } catch {
    /* best-effort : ne bloque jamais l'enregistrement local — l'état reste faux, on retentera */
  }
}

/** F4 — retente la sauvegarde d'une photo locale NON confirmée (au montage de fiche). */
export async function retryImageBackup(recipeId: string): Promise<void> {
  const rec = await loadImage(recipeId);
  if (!rec || rec.backedUp) return;
  await backupImage(recipeId, rec.blob, rec.mime);
}

// Cache négatif de session — F5 : ne retient QUE « l'objet n'existe pas » (404),
// jamais un raté réseau (une photo présente au cloud paraîtrait perdue toute la session).
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
      if (isNotFound(error)) missing.add(recipeId);
      return null;
    }
    await saveImage(recipeId, data, data.type || 'image/jpeg');
    await markImageBackedUp(recipeId); // elle VIENT du cloud — ne pas la re-téléverser
    return data;
  } catch {
    return null;
  }
}
