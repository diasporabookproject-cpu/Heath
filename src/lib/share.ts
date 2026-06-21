import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { AppConfig, Recipe, WeekMenu } from '../types';

// Partage du menu via un LIEN sans backend : on encode (compressé) le menu
// directement dans le hash de l'URL. L'app étant hébergée, la cuisinière
// ouvre une page en lecture seule. L'audio n'entre pas dans un lien
// (placeholder pour l'instant) — il viendra avec le backend.

export const SHARE_PREFIX = '#m=';

export interface SharedMeal {
  n: string; // nom FR
  i: string; // ingrédients FR
  na?: string; // nom darija
  ia?: string; // ingrédients darija
  v?: 1; // une note vocale existe (placeholder côté page partagée)
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

function meal(r: Recipe | undefined, hasVoice: boolean): SharedMeal | undefined {
  if (!r) return undefined;
  const m: SharedMeal = { n: r.nom, i: r.ingredients };
  if (r.nom_ar) m.na = r.nom_ar;
  if (r.ingredients_ar) m.ia = r.ingredients_ar;
  if (hasVoice) m.v = 1;
  return m;
}

/** Construit la charge utile à partir de la semaine (jours non vides). */
export function buildSharePayload(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  audioIds: Set<string>,
): SharedMenu {
  const days: SharedDay[] = [];
  for (const j of config.jours) {
    const day = week.days[j.key];
    if (!day || (!day.dejId && !day.dinId && day.extras.length === 0)) continue;
    const dej = day.dejId ? byId.get(day.dejId) : undefined;
    const din = day.dinId ? byId.get(day.dinId) : undefined;
    const sd: SharedDay = { k: j.key, nom: j.nom, t: j.type };
    const mdej = meal(dej, !!day.dejId && audioIds.has(day.dejId));
    const mdin = meal(din, !!day.dinId && audioIds.has(day.dinId));
    if (mdej) sd.dej = mdej;
    if (mdin) sd.din = mdin;
    const ex = day.extras
      .map((id) => meal(byId.get(id), audioIds.has(id)))
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

/** Lit le menu partagé depuis l'URL courante, s'il y en a un. */
export function readSharedFromLocation(): SharedMenu | null {
  const h = window.location.hash;
  if (!h.startsWith(SHARE_PREFIX)) return null;
  return decodeMenu(h.slice(SHARE_PREFIX.length));
}
