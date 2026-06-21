import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { AppConfig, Recipe, WeekMenu } from '../types';

// Partage du menu via un LIEN sans backend : on encode (compressé) le menu
// directement dans le hash de l'URL. L'app étant hébergée, la cuisinière
// ouvre une page en lecture seule. L'audio n'entre pas dans un lien
// (placeholder pour l'instant) — il viendra avec le backend.

export const SHARE_PREFIX = '#m=';
export const PUBLISH_PREFIX = '#p=';

export interface SharedMeal {
  n: string; // nom FR
  i: string; // ingrédients FR
  na?: string; // nom darija
  ia?: string; // ingrédients darija
  v?: 1; // une note vocale existe (placeholder, lien sans backend)
  a?: string; // URL publique d'une note vocale (lien publié avec audio)
}

export interface SharedDay {
  k: string; // clé jour
  nom: string; // nom FR du jour
  t: string; // type (Repos/Muscu/Cardio)
  dej?: SharedMeal;
  din?: SharedMeal;
  ex?: SharedMeal[];
}

export interface SharedMenu {
  v: 1;
  days: SharedDay[];
}

function meal(
  r: Recipe | undefined,
  id: string | null,
  audioIds: Set<string>,
  audioUrls?: Map<string, string>,
): SharedMeal | undefined {
  if (!r) return undefined;
  const m: SharedMeal = { n: r.nom, i: r.ingredients };
  if (r.nom_ar) m.na = r.nom_ar;
  if (r.ingredients_ar) m.ia = r.ingredients_ar;
  const url = id ? audioUrls?.get(id) : undefined;
  if (url) m.a = url; // lien publié : audio jouable
  else if (id && audioIds.has(id)) m.v = 1; // lien simple : placeholder
  return m;
}

/**
 * Construit la charge utile à partir de la semaine (jours non vides).
 * `audioIds` : recettes ayant une note vocale (→ placeholder).
 * `audioUrls` : URLs publiques des notes (→ audio jouable, lien publié).
 */
export function buildSharePayload(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  audioIds: Set<string>,
  audioUrls?: Map<string, string>,
): SharedMenu {
  const days: SharedDay[] = [];
  for (const j of config.jours) {
    const day = week.days[j.key];
    if (!day || (!day.dejId && !day.dinId && day.extras.length === 0)) continue;
    const dej = day.dejId ? byId.get(day.dejId) : undefined;
    const din = day.dinId ? byId.get(day.dinId) : undefined;
    const sd: SharedDay = { k: j.key, nom: j.nom, t: j.type };
    const mdej = meal(dej, day.dejId, audioIds, audioUrls);
    const mdin = meal(din, day.dinId, audioIds, audioUrls);
    if (mdej) sd.dej = mdej;
    if (mdin) sd.din = mdin;
    const ex = day.extras
      .map((id) => meal(byId.get(id), id, audioIds, audioUrls))
      .filter((m): m is SharedMeal => !!m);
    if (ex.length) sd.ex = ex;
    days.push(sd);
  }
  return { v: 1, days };
}

export function encodeMenu(payload: SharedMenu): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeMenu(encoded: string): SharedMenu | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const data = JSON.parse(json);
    if (data && data.v === 1 && Array.isArray(data.days)) return data as SharedMenu;
    return null;
  } catch {
    return null;
  }
}

/** Lien complet à partager (basé sur l'URL d'hébergement courante). */
export function buildShareUrl(payload: SharedMenu): string {
  const base = window.location.origin + window.location.pathname;
  return base + SHARE_PREFIX + encodeMenu(payload);
}

/** Lit le menu partagé (encodé dans l'URL) s'il y en a un. */
export function readSharedFromLocation(): SharedMenu | null {
  const h = window.location.hash;
  if (!h.startsWith(SHARE_PREFIX)) return null;
  return decodeMenu(h.slice(SHARE_PREFIX.length));
}

/** Lit l'identifiant d'un menu publié (#p=...) s'il y en a un. */
export function readPublishId(): string | null {
  const h = window.location.hash;
  if (!h.startsWith(PUBLISH_PREFIX)) return null;
  const id = h.slice(PUBLISH_PREFIX.length).trim();
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}
