import { getSupabase } from '../supabase';
import { currentFoyerId } from '../auth';
import { saveAudio } from '../db';

// Sauvegarde des notes vocales (S3′). Bucket PRIVÉ par foyer (`foyer-audio`,
// objets préfixés par `foyer_id`, RLS = membres du foyer — cf. 0003). Chemin
// binaire séparé de la sync `docs`. JAMAIS bloquant : si le bucket/RLS ne sont
// pas encore en place (ou hors-ligne), l'app fonctionne comme avant (audio local).
// Restauration PARESSEUSE (au besoin, à la lecture) — pas de rapatriement massif.

const BUCKET = 'foyer-audio';

/** Téléverse une note vocale dans le bucket privé du foyer (fire-and-forget). */
export async function backupAudio(recipeId: string, blob: Blob, mime: string): Promise<void> {
  clearAudioMiss(recipeId);
  try {
    const supa = getSupabase();
    if (!supa) return;
    const foyer = await currentFoyerId();
    if (!foyer) return;
    await supa.storage.from(BUCKET).upload(`${foyer}/${recipeId}`, blob, {
      contentType: mime || 'audio/webm',
      upsert: true,
    });
  } catch {
    /* sauvegarde best-effort : ne bloque jamais l'enregistrement local */
  }
}

// Cache négatif de session : les recettes SANS audio cloud ne redéclenchent pas
// un téléchargement raté à chaque montage (FIX revue Q, efficacité).
const missing = new Set<string>();

/** Restaure une note vocale manquante localement depuis le bucket (paresseux). */
export async function restoreAudio(recipeId: string): Promise<Blob | null> {
  if (missing.has(recipeId)) return null;
  try {
    const supa = getSupabase();
    if (!supa) return null;
    const foyer = await currentFoyerId();
    if (!foyer) return null;
    const { data, error } = await supa.storage.from(BUCKET).download(`${foyer}/${recipeId}`);
    if (error || !data) {
      missing.add(recipeId);
      return null;
    }
    await saveAudio(recipeId, data, data.type || 'audio/webm');
    return data;
  } catch {
    return null;
  }
}

/** À l'enregistrement local, la recette n'est plus « sans audio ». */
export function clearAudioMiss(recipeId: string): void {
  missing.delete(recipeId);
}
