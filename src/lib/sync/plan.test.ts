import { describe, expect, it } from 'vitest';
import {
  docKey,
  refFromKey,
  hashPayload,
  isDirty,
  planPush,
  planPull,
  foyerTransition,
  nextCursor,
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

describe('sync/plan — hashPayload canonique (B3)', () => {
  it('indifférent à l’ordre des clés (récursif) — ferme le ping-pong settings/app', () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(hashPayload({ x: { p: 1, q: 2 }, y: [1, 2] })).toBe(hashPayload({ y: [1, 2], x: { q: 2, p: 1 } }));
  });

  it('sensible au contenu et à l’ordre des tableaux', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload([1, 2])).not.toBe(hashPayload([2, 1]));
  });

  it('undefined ignoré comme JSON.stringify', () => {
    expect(hashPayload({ a: 1, b: undefined })).toBe(hashPayload({ a: 1 }));
  });

  it('un doc pulled puis re-collecté (clés réordonnées) n’est plus dirty', () => {
    // Simule : payload distant (ordre jsonb) synchronisé, puis relu par spread (autre ordre).
    const remoteOrder: LocalDoc = { store: 'settings', docId: 'settings', payload: { objectif: 2000, personnes: 4 } };
    const m = meta(remoteOrder);
    const localReconstructed: LocalDoc = { store: 'settings', docId: 'settings', payload: { personnes: 4, objectif: 2000 } };
    expect(isDirty(localReconstructed, m)).toBe(false);
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

describe('sync/plan — nextCursor (le curseur ne dépasse jamais un doc sauté G2)', () => {
  const r = (docId: string, updatedAt: string): RemoteDoc => ({
    store: 'recipes',
    docId,
    payload: {},
    updatedAt,
    deletedAt: null,
  });

  it('sans doc sauté : avance au max des updated_at', () => {
    expect(nextCursor([r('a', '2026-01-02'), r('b', '2026-01-05')], [], '2026-01-01')).toBe('2026-01-05');
  });

  it("s'arrête juste avant le plus ancien doc sauté", () => {
    const remote = [r('a', '2026-01-02'), r('x', '2026-01-03'), r('b', '2026-01-05')];
    const skipped = [remote[1]]; // x sauté (dirty local)
    expect(nextCursor(remote, skipped, '2026-01-01')).toBe('2026-01-02'); // < 03 : x re-servi au prochain pull
  });

  it('ne recule jamais sous le curseur courant', () => {
    const remote = [r('x', '2026-01-03')];
    expect(nextCursor(remote, [remote[0]], '2026-01-02')).toBe('2026-01-02');
  });
});

describe('sync/plan — foyerTransition (l’adoption est morte)', () => {
  it('jamais synchronisé → first-attach : cycle NORMAL, le push téléverse le local', () => {
    // Option A du read-back : les données déjà sur l'appareil rejoignent le foyer
    // qu'on vient de fonder. Aucune purge — les perdre serait la vraie régression.
    expect(foyerTransition(null, 'F1')).toBe('first-attach');
  });

  it('même foyer → same', () => {
    expect(foyerTransition('F1', 'F1')).toBe('same');
  });

  it('AUTRE foyer → switch : le foyer d’arrivée fait foi', () => {
    expect(foyerTransition('F1', 'F2')).toBe('switch');
  });

  it('« rejoindre ne fusionne plus rien » : un switch n’est jamais un first-attach', () => {
    // C'est la garde contre le défaut que la simple suppression d'`adopt` créait :
    // méta vidée → tous les docs locaux « dirty » → push → le contenu de l'ancien
    // foyer se déverse dans le nouveau. `switch` interdit le push.
    for (const [last, next] of [['F1', 'F2'], ['F2', 'F1'], ['A', 'B']] as const) {
      expect(foyerTransition(last, next)).not.toBe('first-attach');
      expect(foyerTransition(last, next)).toBe('switch');
    }
  });
});

// ── Ce qui DOIT voyager : les règles du foyer (exigence PO du GO, lot Cuisine T3).
// La preuve portait sur `planAdopt` ; l'adoption morte, elle est PORTÉE sur le
// couple push/pull, qui est désormais le seul chemin des données.
describe('sync/plan — les règles du foyer voyagent (push/pull, store générique)', () => {
  const at = '2026-01-01T00:00:00Z';
  const REGLES = { halal: true, nePasManger: ['arachide'] };
  const remoteRegles: RemoteDoc = { store: 'foyer', docId: 'regles', payload: REGLES, updatedAt: at, deletedAt: null };

  it('appareil qui FONDE le foyer : ses règles partent au push', () => {
    const local: LocalDoc[] = [{ store: 'foyer', docId: 'regles', payload: REGLES }];
    expect(planPush(local, {}).upserts).toEqual(local);
  });

  it('foyer REJOINT : les règles du foyer sont adoptées en local au pull', () => {
    // Après un `switch`, le local est purgé et la méta vidée : le pull applique tout.
    const plan = planPull([remoteRegles], {}, {});
    expect(plan.applies).toEqual([remoteRegles]); // → saveFoyerRegles à l'application
    expect(plan.skipped).toEqual([]);
  });

  it('collision : les règles du FOYER font foi quand le local est propre', () => {
    const synced: LocalDoc = { store: 'foyer', docId: 'regles', payload: REGLES };
    const remoteNewer: RemoteDoc = { ...remoteRegles, payload: { halal: false, nePasManger: [] }, updatedAt: '2026-01-02T00:00:00Z' };
    const plan = planPull([remoteNewer], { [docKey(synced)]: synced }, meta(synced));
    expect(plan.applies).toEqual([remoteNewer]);
  });

  it('pull : une édition locale des règles non poussée n’est JAMAIS écrasée (garde G2)', () => {
    const localDoc: LocalDoc = {
      store: 'foyer',
      docId: 'regles',
      payload: { halal: true, nePasManger: ['arachide', 'sésame'] }, // édité localement
    };
    const synced: LocalDoc = { store: 'foyer', docId: 'regles', payload: REGLES };
    const remoteNewer: RemoteDoc = { ...remoteRegles, updatedAt: '2026-01-02T00:00:00Z' };
    const plan = planPull([remoteNewer], { [docKey(localDoc)]: localDoc }, meta(synced));
    expect(plan.applies).toEqual([]); // pas d'écrasement silencieux
    expect(plan.skipped).toEqual([remoteNewer]); // re-servi après le prochain push
  });

  it('push : des règles modifiées sont détectées dirty et poussées', () => {
    const synced: LocalDoc = { store: 'foyer', docId: 'regles', payload: REGLES };
    const edited: LocalDoc = { ...synced, payload: { ...REGLES, halal: false } };
    const plan = planPush([edited], meta(synced));
    expect(plan.upserts).toEqual([edited]);
    expect(plan.tombstones).toEqual([]);
  });
});
