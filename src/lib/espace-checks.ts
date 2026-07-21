import { getSupabase } from './supabase';

// Lot partage + suivi des tâches, T2 (read-back GO) — le SOCLE des coches.
// Journal INSERT-ONLY `espace_checks` (migration 0011, patron espace_opens) :
// chaque geste = un événement ; l'état courant = la DERNIÈRE ligne par item
// (réduction LWW ici, pure et testée). Écriture/lecture par JETON, sans compte
// (policies 0011 : jointure d'existence sur `espaces` — jeton révoqué = refus
// d'écrire ET coches illisibles, exigence 🔴 du read-back).
//
// OFFLINE (invariant produit) : la coche s'applique localement d'abord ; les
// événements non transmis attendent dans une FILE locale (stockage injectable,
// localStorage en prod) et se rejouent DANS L'ORDRE au retour du réseau.
// Un refus RLS (jeton mort) PURGE la file : le lien est coupé, l'activité ne
// remonte plus — c'est le comportement voulu, pas une erreur.

export interface CheckEvent {
  item: string;
  done: boolean;
  /** ISO — l'instant du GESTE (ordre local) ; le serveur horodate l'ARRIVÉE. */
  at: string;
}

export interface CheckState {
  done: boolean;
  at: string;
}

/* ── Clés d'item ─────────────────────────────────────────────────────────── */

/** Hash court déterministe (FNV-1a → base36) — stable partout, sans dépendance. */
function h6(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

/**
 * Clé d'un REPAS cochable : jour + moment + EMPREINTE DU NOM DU PLAT.
 * Décision PO (read-back ②) : l'employeur change le plat et republie → la clé
 * TOURNE → la case redémarre décochée (le nouveau plat n'a pas été cuisiné).
 * Les coches orphelines restent au journal, ignorées au rendu.
 */
export function mealItemKey(dayKey: string, mealKey: string, platNom: string): string {
  return `d:${dayKey}:${mealKey}:${h6(platNom)}`;
}

/** Clé d'une TÂCHE LIBRE (texte de l'employeur) : id généré à la création, stable. */
export function taskItemKey(id: string): string {
  return `t:${id}`;
}

/* ── Réduction (pur) ─────────────────────────────────────────────────────── */

/** Dernier-écrit-gagne PAR ITEM. `events` dans l'ordre d'arrivée (le serveur
 * renvoie `order by at asc` ; à égalité l'ordre de la liste tranche). */
export function reduceChecks(events: CheckEvent[]): Map<string, CheckState> {
  const out = new Map<string, CheckState>();
  for (const e of events) out.set(e.item, { done: e.done, at: e.at });
  return out;
}

/** Combien d'items sont FAITS dans un journal (réduit LWW puis compte les done).
 * Le compteur du « retour employeur » (T4). */
export function countDone(events: CheckEvent[]): number {
  let n = 0;
  for (const st of reduceChecks(events).values()) if (st.done) n++;
  return n;
}

/** L'état rendu = serveur ⊕ file locale : le geste local (plus récent, pas
 * encore transmis) PRIME sur ce que le serveur connaît. */
export function mergePending(
  server: Map<string, CheckState>,
  pending: CheckEvent[],
): Map<string, CheckState> {
  const out = new Map(server);
  for (const e of pending) out.set(e.item, { done: e.done, at: e.at });
  return out;
}

/* ── File offline (stockage injectable — localStorage en prod) ───────────── */

type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const pendingKey = (token: string) => `espace-checks-pending:${token}`;

function defaultStore(): StoreLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadPending(token: string, store: StoreLike | null = defaultStore()): CheckEvent[] {
  if (!store) return [];
  try {
    const raw = store.getItem(pendingKey(token));
    return raw ? (JSON.parse(raw) as CheckEvent[]) : [];
  } catch {
    return [];
  }
}

export function queuePending(
  token: string,
  ev: CheckEvent,
  store: StoreLike | null = defaultStore(),
): void {
  if (!store) return;
  const all = loadPending(token, store);
  all.push(ev);
  try {
    store.setItem(pendingKey(token), JSON.stringify(all));
  } catch {
    /* stockage plein / privé : la coche reste appliquée à l'écran */
  }
}

export function clearPending(token: string, store: StoreLike | null = defaultStore()): void {
  store?.removeItem(pendingKey(token));
}

/* ── I/O serveur (best-effort, jamais bloquant pour la page) ─────────────── */

export type SendResult = 'ok' | 'rejected' | 'offline';

/** Envoie UN événement. `rejected` = refus RLS (jeton mort) — définitif ;
 * `offline` = réseau/indispo — à retenter. */
export async function sendCheck(token: string, ev: CheckEvent): Promise<SendResult> {
  const supa = getSupabase();
  if (!supa) return 'offline';
  try {
    const { error } = await supa
      .from('espace_checks')
      .insert({ token, item: ev.item, done: ev.done, at: ev.at });
    if (!error) return 'ok';
    // 42501 = insufficient_privilege (violation RLS) : le jeton ne vit plus.
    if (error.code === '42501' || /row-level security/i.test(error.message)) return 'rejected';
    return 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * Rejoue la file DANS L'ORDRE. S'arrête au premier `offline` (le reste attend) ;
 * PURGE tout sur `rejected` (jeton révoqué — l'activité ne remonte plus, F1).
 */
export async function flushPending(
  token: string,
  store: StoreLike | null = defaultStore(),
): Promise<void> {
  const all = loadPending(token, store);
  if (all.length === 0) return;
  let i = 0;
  while (i < all.length) {
    const res = await sendCheck(token, all[i]);
    if (res === 'offline') break;
    if (res === 'rejected') {
      clearPending(token, store);
      return;
    }
    i++;
  }
  const rest = all.slice(i);
  if (rest.length === 0) clearPending(token, store);
  else if (store) {
    try {
      store.setItem(pendingKey(token), JSON.stringify(rest));
    } catch {
      /* ignoré */
    }
  }
}

/** Lit le journal d'un jeton (ordre d'arrivée). `null` = INJOIGNABLE (réseau/
 * indispo) — distinct de « vraiment vide » : l'appelant sert alors son cache. */
export async function readChecks(token: string): Promise<CheckEvent[] | null> {
  const supa = getSupabase();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from('espace_checks')
      .select('item, done, at')
      .eq('token', token)
      .order('at', { ascending: true });
    if (error || !data) return null;
    return data as CheckEvent[];
  } catch {
    return null;
  }
}

/* ── Cache local du journal (la page OFFLINE montre le dernier état connu) ── */

const cacheEventsKey = (token: string) => `espace-checks-cache:${token}`;

export function loadCachedEvents(token: string, store: StoreLike | null = defaultStore()): CheckEvent[] {
  if (!store) return [];
  try {
    const raw = store.getItem(cacheEventsKey(token));
    return raw ? (JSON.parse(raw) as CheckEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveCachedEvents(
  token: string,
  events: CheckEvent[],
  store: StoreLike | null = defaultStore(),
): void {
  try {
    store?.setItem(cacheEventsKey(token), JSON.stringify(events));
  } catch {
    /* stockage plein / privé : le cache est un confort */
  }
}
