import { describe, expect, it } from 'vitest';
import {
  docKey,
  refFromKey,
  hashPayload,
  isDirty,
  planPush,
  planPull,
  planAdopt,
  type MetaIndex,
  type LocalDoc,
  type RemoteDoc,
} from './plan';

const meta = (doc: LocalDoc, syncedAt = '2026-01-01T00:00:00Z'): MetaIndex => ({
  [docKey(doc)]: { syncedHash: hashPayload(doc.payload), syncedAt },
});

describe('sync/plan — clés & dirty', () => {
  it('docKey / refFromKey aller-retour (docId avec ":")', () => {
    const ref = { store: 'recipes' as const, docId: 'a:b:c' };
    expect(refFromKey(docKey(ref))).toEqual(ref);
  });

  it('isDirty : jamais synchronisé = dirty ; identique = propre ; modifié = dirty', () => {
    const d: LocalDoc = { store: 'recipes', docId: 'r1', payload: { n: 1 } };
    expect(isDirty(d, {})).toBe(true);
    expect(isDirty(d, meta(d))).toBe(false);
    const changed = { ...d, payload: { n: 2 } };
    expect(isDirty(changed, meta(d))).toBe(true);
  });
});

describe('sync/plan — planPush', () => {
  it('pousse les dirty, ignore les à-jour, tombstone les disparus', () => {
    const a: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 1 } };
    const b: LocalDoc = { store: 'recipes', docId: 'b', payload: { v: 1 } };
    // méta : a est à jour, c a été synchronisé mais n'est plus local (supprimé)
    const m: MetaIndex = {
      ...meta(a),
      'recipes:c': { syncedHash: 'x', syncedAt: '2026-01-01T00:00:00Z' },
    };
    const plan = planPush([a, b], m);
    expect(plan.upserts.map((d) => d.docId)).toEqual(['b']); // a à jour, b jamais synchro
    expect(plan.tombstones).toEqual([{ store: 'recipes', docId: 'c' }]);
  });
});

describe('sync/plan — planPull (LWW + G2)', () => {
  const r = (docId: string, payload: unknown, updatedAt: string, deletedAt: string | null = null): RemoteDoc => ({
    store: 'recipes',
    docId,
    payload,
    updatedAt,
    deletedAt,
  });

  it('applique un remote plus récent (local propre)', () => {
    const local: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 1 } };
    const m = meta(local, '2026-01-01T00:00:00Z');
    const plan = planPull([r('a', { v: 2 }, '2026-02-01T00:00:00Z')], { [docKey(local)]: local }, m);
    expect(plan.applies.map((x) => x.docId)).toEqual(['a']);
    expect(plan.skipped).toEqual([]);
  });

  it('ignore un remote pas plus récent que syncedAt', () => {
    const local: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 1 } };
    const m = meta(local, '2026-03-01T00:00:00Z');
    const plan = planPull([r('a', { v: 9 }, '2026-02-01T00:00:00Z')], { [docKey(local)]: local }, m);
    expect(plan.applies).toEqual([]);
  });

  it('G2 : un doc local dirty n’est jamais écrasé (skip)', () => {
    const synced: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 1 } };
    const m = meta(synced, '2026-01-01T00:00:00Z');
    const localDirty: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 99 } }; // édité localement
    const plan = planPull([r('a', { v: 2 }, '2026-02-01T00:00:00Z')], { [docKey(synced)]: localDirty }, m);
    expect(plan.applies).toEqual([]);
    expect(plan.skipped.map((x) => x.docId)).toEqual(['a']);
  });

  it('tombstone distant : delete si présent, rien si déjà absent', () => {
    const local: LocalDoc = { store: 'recipes', docId: 'a', payload: { v: 1 } };
    const m = { ...meta(local, '2026-01-01T00:00:00Z'), 'recipes:b': { syncedHash: 'x', syncedAt: '2026-01-01T00:00:00Z' } };
    const plan = planPull(
      [r('a', null, '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z'), r('b', null, '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z')],
      { [docKey(local)]: local }, // 'b' absent en local
      m,
    );
    expect(plan.deletes.map((x) => x.docId)).toEqual(['a']);
  });
});

describe('sync/plan — planAdopt (union, cloud gagne sur collision)', () => {
  it('upload le local-seul, adopte le remote vivant, cloud gagne en collision', () => {
    const local: LocalDoc[] = [
      { store: 'recipes', docId: 'onlyLocal', payload: { v: 1 } },
      { store: 'recipes', docId: 'both', payload: { v: 'local' } },
    ];
    const remote: RemoteDoc[] = [
      { store: 'recipes', docId: 'both', payload: { v: 'cloud' }, updatedAt: '2026-01-01T00:00:00Z', deletedAt: null },
      { store: 'recipes', docId: 'onlyRemote', payload: { v: 2 }, updatedAt: '2026-01-01T00:00:00Z', deletedAt: null },
      { store: 'recipes', docId: 'deadRemote', payload: null, updatedAt: '2026-01-01T00:00:00Z', deletedAt: '2026-01-01T00:00:00Z' },
    ];
    const plan = planAdopt(local, remote);
    expect(plan.upload.map((d) => d.docId)).toEqual(['onlyLocal']); // 'both' NON uploadé (cloud gagne)
    expect(plan.adoptRemote.map((r) => r.docId)).toEqual(['both', 'onlyRemote']); // tombstone ignoré
  });
});
