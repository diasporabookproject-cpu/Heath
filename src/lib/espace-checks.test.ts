import { beforeEach, describe, expect, it, vi } from 'vitest';

// T2 (lot partage) — TESTS BLOQUANTS du socle des coches :
// clés d'item (déterminisme + ROTATION au changement de plat, décision PO ②),
// réduction LWW (concurrence par item), file offline (ordre, arrêt sur réseau,
// PURGE sur refus RLS = jeton révoqué).

const insertMock = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      insert: insertMock,
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
    }),
  }),
}));

import {
  clearPending,
  flushPending,
  loadPending,
  mealItemKey,
  mergePending,
  queuePending,
  reduceChecks,
  sendCheck,
  taskItemKey,
  type CheckEvent,
} from './espace-checks';

/** Stockage en mémoire (l'injection évite localStorage — absent en node). */
function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const ev = (item: string, done: boolean, at: string): CheckEvent => ({ item, done, at });

beforeEach(() => insertMock.mockReset());

describe('clés d’item', () => {
  it('déterministes et distinctes par préfixe', () => {
    expect(mealItemKey('lun', 'dej', 'Tajine')).toBe(mealItemKey('lun', 'dej', 'Tajine'));
    expect(mealItemKey('lun', 'dej', 'Tajine').startsWith('d:lun:dej:')).toBe(true);
    expect(taskItemKey('abc')).toBe('t:abc');
  });

  it('ROTATION (décision PO ②) : le plat change → la clé change → case décochée', () => {
    expect(mealItemKey('lun', 'dej', 'Tajine')).not.toBe(mealItemKey('lun', 'dej', 'Harira'));
    // même nom ailleurs → clés distinctes par créneau
    expect(mealItemKey('lun', 'dej', 'Tajine')).not.toBe(mealItemKey('mar', 'dej', 'Tajine'));
  });
});

describe('réduction LWW (concurrence par item)', () => {
  it('le DERNIER geste gagne, par item indépendant', () => {
    const state = reduceChecks([
      ev('a', true, '10:00'),
      ev('b', true, '10:01'),
      ev('a', false, '10:02'), // décoche après coup
    ]);
    expect(state.get('a')).toEqual({ done: false, at: '10:02' });
    expect(state.get('b')).toEqual({ done: true, at: '10:01' });
  });

  it('la file locale PRIME sur l’état serveur (geste le plus récent de la personne)', () => {
    const server = reduceChecks([ev('a', false, '09:00')]);
    const merged = mergePending(server, [ev('a', true, '09:30'), ev('c', true, '09:31')]);
    expect(merged.get('a')?.done).toBe(true);
    expect(merged.get('c')?.done).toBe(true);
  });
});

describe('file offline', () => {
  it('queue → load conserve l’ordre ; clear vide', () => {
    const st = fakeStore();
    queuePending('tok', ev('a', true, '1'), st);
    queuePending('tok', ev('b', true, '2'), st);
    expect(loadPending('tok', st).map((e) => e.item)).toEqual(['a', 'b']);
    clearPending('tok', st);
    expect(loadPending('tok', st)).toEqual([]);
  });

  it('flush : envoie dans l’ordre et vide la file', async () => {
    const st = fakeStore();
    queuePending('tok', ev('a', true, '1'), st);
    queuePending('tok', ev('b', false, '2'), st);
    insertMock.mockResolvedValue({ error: null });
    await flushPending('tok', st);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0].item).toBe('a');
    expect(insertMock.mock.calls[1][0].item).toBe('b');
    expect(loadPending('tok', st)).toEqual([]);
  });

  it('flush : coupure réseau au 2e → le RESTE attend (rien de perdu)', async () => {
    const st = fakeStore();
    queuePending('tok', ev('a', true, '1'), st);
    queuePending('tok', ev('b', true, '2'), st);
    insertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '', message: 'fetch failed' } });
    await flushPending('tok', st);
    expect(loadPending('tok', st).map((e) => e.item)).toEqual(['b']);
  });

  it('flush : refus RLS (jeton RÉVOQUÉ) → PURGE totale — l’activité ne remonte plus (F1)', async () => {
    const st = fakeStore();
    queuePending('tok', ev('a', true, '1'), st);
    queuePending('tok', ev('b', true, '2'), st);
    insertMock.mockResolvedValue({
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    await flushPending('tok', st);
    expect(loadPending('tok', st)).toEqual([]);
    expect(insertMock).toHaveBeenCalledTimes(1); // on n'insiste pas sur un lien mort
  });
});

describe('sendCheck — classification des issues', () => {
  it('ok / rejected (RLS) / offline (réseau)', async () => {
    insertMock.mockResolvedValueOnce({ error: null });
    expect(await sendCheck('t', ev('a', true, '1'))).toBe('ok');
    insertMock.mockResolvedValueOnce({ error: { code: '42501', message: 'rls' } });
    expect(await sendCheck('t', ev('a', true, '1'))).toBe('rejected');
    insertMock.mockResolvedValueOnce({ error: { code: '08006', message: 'connection failure' } });
    expect(await sendCheck('t', ev('a', true, '1'))).toBe('offline');
  });
});
