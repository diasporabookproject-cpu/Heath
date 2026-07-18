import { describe, expect, it } from 'vitest';
import {
  docKey,
  refFromKey,
  hashPayload,
  isDirty,
  planPush,
  planPull,
  planAdopt,
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
    expect(plan.dropLocal).toEqual([]); // pas de contenu de pack en jeu ici
  });
});

// ── F5a-② (Flow FTUE, option b) : la fusion ne déverse PAS le contenu de pack ──
describe('sync/plan — planAdopt : dédup du contenu de pack (F5a-②)', () => {
  const at = '2026-01-01T00:00:00Z';
  const remoteRec = (docId: string, nom: string, deleted = false): RemoteDoc => ({
    store: 'recipes',
    docId,
    payload: { nom },
    updatedAt: at,
    deletedAt: deleted ? at : null,
  });

  it('recette de PACK dont le nom vit déjà dans le foyer → dropLocal, PAS upload', () => {
    const local: LocalDoc[] = [
      { store: 'recipes', docId: 'l1', payload: { nom: 'Tajine poulet', packId: 'fonds-de-depart' } },
    ];
    const remote = [remoteRec('r1', 'tajine POULET')]; // même nom, casse différente
    const plan = planAdopt(local, remote);
    expect(plan.upload).toEqual([]);
    expect(plan.dropLocal).toEqual([{ store: 'recipes', docId: 'l1' }]);
    expect(plan.adoptRemote.map((r) => r.docId)).toEqual(['r1']); // le jumeau du foyer remplace
  });

  it('« on garde TES choses » : recette FAITE MAIN (sans packId) → uploadée même à nom égal', () => {
    const local: LocalDoc[] = [
      { store: 'recipes', docId: 'l1', payload: { nom: 'Tajine poulet' } }, // pas de packId
    ];
    const plan = planAdopt(local, [remoteRec('r1', 'Tajine poulet')]);
    expect(plan.upload.map((d) => d.docId)).toEqual(['l1']); // fusion Q1 inchangée pour le personnel
    expect(plan.dropLocal).toEqual([]);
  });

  it('recette de pack ABSENTE du foyer → uploadée (le foyer la gagne, zéro doublon)', () => {
    const local: LocalDoc[] = [
      { store: 'recipes', docId: 'l1', payload: { nom: 'Harira', packId: 'fonds-de-depart' } },
    ];
    const plan = planAdopt(local, [remoteRec('r1', 'Tajine poulet')]);
    expect(plan.upload.map((d) => d.docId)).toEqual(['l1']);
    expect(plan.dropLocal).toEqual([]);
  });

  it('un tombstone distant ne compte PAS comme « nom présent » ; autres stores intouchés', () => {
    const local: LocalDoc[] = [
      { store: 'recipes', docId: 'l1', payload: { nom: 'Harira', packId: 'p' } },
      { store: 'securite', docId: 's1', payload: { titre: 'Fièvre', packId: 'p', nom: 'Fièvre' } },
    ];
    const plan = planAdopt(local, [remoteRec('r1', 'Harira', true)]); // supprimée côté foyer
    expect(plan.upload.map((d) => d.docId)).toEqual(['l1', 's1']); // les deux partent
    expect(plan.dropLocal).toEqual([]);
  });
});

// ── T3 (lot Cuisine, Q1) : règles du foyer = store 'foyer' sur la table `docs` ──
// Exigence PO du GO : PROUVER que l'adoption transporte les restrictions —
// pendant de l'anti-fuite F5a du lot FTUE, côté « ce qui DOIT voyager ».
describe('sync/plan — planAdopt & pull : règles du foyer (store générique, T3)', () => {
  const at = '2026-01-01T00:00:00Z';
  const REGLES = { halal: true, nePasManger: ['arachide'] };
  const remoteRegles: RemoteDoc = {
    store: 'foyer',
    docId: 'regles',
    payload: REGLES,
    updatedAt: at,
    deletedAt: null,
  };

  it('foyer rejoint : les restrictions du foyer sont ADOPTÉES en local', () => {
    // Appareil vierge (aucune règle locale) qui rejoint un foyer réglé.
    const plan = planAdopt([], [remoteRegles]);
    expect(plan.adoptRemote).toEqual([remoteRegles]); // → saveFoyerRegles à l'application
    expect(plan.upload).toEqual([]);
    expect(plan.dropLocal).toEqual([]);
  });

  it('appareil déjà réglé qui FONDE le foyer : ses règles sont téléversées', () => {
    const local: LocalDoc[] = [{ store: 'foyer', docId: 'regles', payload: REGLES }];
    const plan = planAdopt(local, []);
    expect(plan.upload).toEqual(local);
    expect(plan.dropLocal).toEqual([]);
  });

  it('collision (les deux ont des règles) : celles du FOYER rejoint font foi (cloud gagne)', () => {
    const local: LocalDoc[] = [
      { store: 'foyer', docId: 'regles', payload: { halal: false, nePasManger: ['végétarien'] } },
    ];
    const plan = planAdopt(local, [remoteRegles]);
    expect(plan.upload).toEqual([]); // les règles locales ne partent pas
    expect(plan.adoptRemote).toEqual([remoteRegles]); // celles du foyer les remplacent
    expect(plan.dropLocal).toEqual([]);
  });

  it('la dédup de pack (F5a-②) ne touche JAMAIS le store foyer (garde store === recipes)', () => {
    // Un doc foyer qui ressemble à une recette de pack (nom + packId) ne doit
    // pas être avalé par isPackDupe : la garde porte sur le STORE, pas la forme.
    const local: LocalDoc[] = [
      { store: 'foyer', docId: 'regles', payload: { nom: 'Tajine poulet', packId: 'fonds-de-depart' } },
    ];
    const remote: RemoteDoc[] = [
      { store: 'recipes', docId: 'r1', payload: { nom: 'Tajine poulet' }, updatedAt: at, deletedAt: null },
    ];
    const plan = planAdopt(local, remote);
    expect(plan.upload.map((d) => d.store)).toEqual(['foyer']);
    expect(plan.dropLocal).toEqual([]);
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
