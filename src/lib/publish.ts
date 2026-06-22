import { SUPABASE_KEY, SUPABASE_URL } from './supabase';
import { buildSharePayload, PUBLISH_PREFIX, type SharedMenu } from './share';
import { loadAudio } from './db';
import type { AppConfig, Recipe, WeekMenu } from '../types';

// Publication d'un menu AVEC ses notes vocales : on téléverse les audios et un
// JSON du menu dans le bucket public `shared`, puis on renvoie un lien court.
// On utilise des requêtes REST directes avec la clé publishable (accès anonyme),
// ce qui est déterministe et ne dépend pas de l'état de session.

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

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function uploadObject(path: string, body: Blob): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY!}`,
      'Content-Type': body.type || 'application/octet-stream',
      // pas de x-upsert : chaque publication a un id unique (insert simple) ;
      // l'upsert déclenche un refus RLS pour un accès anonyme.
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

export interface PublishResult {
  url: string;
  audioCount: number;
}

export async function publishMenu(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
): Promise<PublishResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Synchro non configurée.');

  const id = newId();
  const audioUrls = new Map<string, string>();

  for (const rid of usedRecipeIds(config, week)) {
    const blob = await loadAudio(rid);
    if (!blob) continue;
    const path = `${id}/${rid}.${extFor(blob.type)}`;
    await uploadObject(path, blob);
    audioUrls.set(rid, publicUrl(path));
  }

  const payload = buildSharePayload(config, week, byId, new Set(audioUrls.keys()), audioUrls);
  await uploadObject(`${id}.json`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));

  const base = window.location.origin + window.location.pathname;
  return { url: base + PUBLISH_PREFIX + id, audioCount: audioUrls.size };
}

/** Récupère un menu publié (côté cuisinière, lecture publique, sans connexion). */
export async function fetchPublishedMenu(id: string): Promise<SharedMenu> {
  if (!SUPABASE_URL) throw new Error('Lien non disponible.');
  const res = await fetch(publicUrl(`${id}.json`));
  if (!res.ok) throw new Error('Menu introuvable (lien expiré ?).');
  return (await res.json()) as SharedMenu;
}
