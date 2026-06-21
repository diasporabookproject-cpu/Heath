import { getSupabase, SUPABASE_URL } from './supabase';
import { buildSharePayload, PUBLISH_PREFIX, type SharedMenu } from './share';
import { loadAudio } from './db';
import type { AppConfig, Recipe, WeekMenu } from '../types';

// Publication d'un menu AVEC ses notes vocales : on téléverse les audios et un
// JSON du menu dans le bucket public `shared`, et on renvoie un lien unique.
// La cuisinière ouvre ce lien : la page lit le JSON public et joue les audios.

const BUCKET = 'shared';

function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'audio';
}

function newId(): string {
  const rnd = (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).replace(/[^a-z0-9]/gi, '');
  return rnd.slice(0, 12);
}

/** Recettes (ids uniques) réellement utilisées dans la semaine. */
function usedRecipeIds(config: AppConfig, week: WeekMenu): string[] {
  const ids = new Set<string>();
  for (const j of config.jours) {
    const d = week.days[j.key];
    if (!d) continue;
    if (d.dejId) ids.add(d.dejId);
    if (d.dinId) ids.add(d.dinId);
    for (const e of d.extras) ids.add(e);
  }
  return [...ids];
}

export interface PublishResult {
  url: string;
  audioCount: number;
}

export async function publishMenu(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
): Promise<PublishResult> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const { data: sess } = await supa.auth.getSession();
  if (!sess.session) throw new Error('Connecte-toi pour partager avec les notes vocales.');

  const id = newId();
  const audioUrls = new Map<string, string>();

  for (const rid of usedRecipeIds(config, week)) {
    const blob = await loadAudio(rid);
    if (!blob) continue;
    const path = `${id}/${rid}.${extFor(blob.type)}`;
    const up = await supa.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || 'audio/webm',
      upsert: true,
    });
    if (up.error) throw new Error('Upload audio : ' + up.error.message);
    audioUrls.set(rid, supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  const payload = buildSharePayload(config, week, byId, new Set(audioUrls.keys()), audioUrls);
  const json = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const upJson = await supa.storage.from(BUCKET).upload(`${id}.json`, json, {
    contentType: 'application/json',
    upsert: true,
  });
  if (upJson.error) throw new Error('Upload menu : ' + upJson.error.message);

  const base = window.location.origin + window.location.pathname;
  return { url: base + PUBLISH_PREFIX + id, audioCount: audioUrls.size };
}

/** Récupère un menu publié (côté cuisinière, lecture publique, sans connexion). */
export async function fetchPublishedMenu(id: string): Promise<SharedMenu> {
  if (!SUPABASE_URL) throw new Error('Lien non disponible.');
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Menu introuvable (lien expiré ?).');
  return (await res.json()) as SharedMenu;
}
