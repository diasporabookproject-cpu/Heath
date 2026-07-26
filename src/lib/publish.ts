import { getSupabase, SUPABASE_KEY, SUPABASE_URL } from './supabase';
import { usedRecipeIds } from './share';
import { loadAudio } from './db';
import type { AppConfig, WeekMenu } from '../types';

// Téléversement des notes vocales (bucket public `shared`) pour les espaces des
// destinataires. L'écriture se fait en tant qu'utilisateur connecté (jeton de session).

const BUCKET = 'shared';

function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'audio';
}

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Jeton de la session courante (upload réservé aux utilisateurs connectés). */
export async function getAccessToken(): Promise<string> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const { data } = await supa.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Connectez-vous pour partager avec les notes vocales.');
  return token;
}

async function uploadObject(path: string, body: Blob, token: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${token}`,
      'Content-Type': body.type || 'application/octet-stream',
    },
    body,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.message ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`${res.status} ${detail}`.trim());
  }
}

/** Téléverse les notes vocales d'un ensemble d'ids → map id -> URL publique. */
export async function uploadAudios(
  ids: string[],
  prefix: string,
  token: string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const id of ids) {
    const blob = await loadAudio(id);
    if (!blob) continue;
    const path = `${prefix}/${id}.${extFor(blob.type)}`;
    await uploadObject(path, blob, token);
    urls.set(id, publicUrl(path));
  }
  return urls;
}

export async function uploadWeekAudios(
  config: AppConfig,
  week: WeekMenu,
  prefix: string,
  token: string,
): Promise<Map<string, string>> {
  return uploadAudios(usedRecipeIds(config, week), prefix, token);
}
