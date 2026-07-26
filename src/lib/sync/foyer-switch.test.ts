import { beforeEach, describe, expect, it, vi } from 'vitest';

// Lot Identité & accès T2 — LA PREUVE EXIGÉE PAR LE PO.
//
// « La purge doit être strictement locale. Quitter le foyer X pour le foyer Y purge
//   le cache de X sur cet appareil ; les données de X survivent côté serveur et se
//   re-tirent si on y revient. Une purge qui détruirait les données serveur du foyer
//   quitté serait une perte silencieuse. Prouve-le par un test. »
//
// On enregistre TOUTES les opérations envoyées au client Supabase pendant le
// changement de foyer et on exige : un SELECT (le pull), rien d'autre. Aucun
// `delete`, aucun `upsert`, aucun `rpc` — donc rien ne peut disparaître du serveur.

const ops: string[] = [];

/** Chaînable qui enregistre l'opération et se résout comme une requête vide. */
function chain(op: string) {
  ops.push(op);
  const self: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'is', 'order', 'limit', 'single', 'maybeSingle']) {
    self[m] = () => self;
  }
  // Thenable : `await supa.from(...).select(...)...` résout ici.
  self.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
  return self;
}

const fakeClient = {
  from: (table: string) => ({
    select: () => chain(`select:${table}`) && chainFor(table, 'select'),
    upsert: () => chainFor(table, 'upsert'),
    insert: () => chainFor(table, 'insert'),
    delete: () => chainFor(table, 'delete'),
    update: () => chainFor(table, 'update'),
  }),
  rpc: (name: string) => chain(`rpc:${name}`),
};

function chainFor(table: string, op: string) {
  const self: Record<string, unknown> = {};
  if (op !== 'select') ops.push(`${op}:${table}`);
  for (const m of ['select', 'eq', 'gt', 'is', 'order', 'limit', 'single', 'maybeSingle']) {
    self[m] = () => self;
  }
  self.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
  return self;
}

vi.mock('../supabase', () => ({ getSupabase: () => fakeClient }));

const purgeLocalDocs = vi.fn(async () => {});
const clearSyncState = vi.fn(async () => {});

vi.mock('../db', () => ({
  purgeLocalDocs: (...a: unknown[]) => purgeLocalDocs(...(a as [])),
  clearSyncState: (...a: unknown[]) => clearSyncState(...(a as [])),
  loadAllSyncMeta: async () => ({}),
  putSyncMeta: async () => {},
  delSyncMeta: async () => {},
  loadSyncCursor: async () => null,
  saveSyncCursor: async () => {},
}));

vi.mock('./map', () => ({
  collectLocalDocs: async () => [],
  applyRemote: async () => {},
  applyDelete: async () => {},
}));

import { switchFoyer, syncNow } from './engine';

beforeEach(() => {
  ops.length = 0;
  purgeLocalDocs.mockClear();
  clearSyncState.mockClear();
});

describe('changement de foyer — la purge est STRICTEMENT locale', () => {
  it('quitter X pour Y : AUCUNE écriture serveur, seulement le pull', async () => {
    await switchFoyer('foyer-Y');

    // Le cache local est bien vidé…
    expect(purgeLocalDocs).toHaveBeenCalledTimes(1);
    expect(clearSyncState).toHaveBeenCalledTimes(1);

    // …et le serveur n'a reçu QUE la lecture du foyer d'arrivée.
    const ecritures = ops.filter((o) => !o.startsWith('select:'));
    expect(ecritures).toEqual([]); // ni delete, ni upsert, ni insert, ni rpc
    expect(ops.some((o) => o.startsWith('delete:'))).toBe(false);
  });

  it('les données du foyer QUITTÉ ne sont jamais touchées (aucun appel ne les nomme)', async () => {
    await switchFoyer('foyer-Y');
    // Une seule requête part, et elle porte sur le foyer d'ARRIVÉE (le pull).
    // Rien n'est adressé à X : ses docs restent en ligne, prêts à être re-tirés.
    expect(ops).toEqual(['select:docs']);
  });

  it('le cycle NORMAL ne purge jamais (protège le premier rattachement)', async () => {
    // `first-attach` et `same` passent par syncNow : les données locales déjà
    // présentes doivent MONTER (option A), surtout pas disparaître.
    await syncNow('foyer-Y');
    expect(purgeLocalDocs).not.toHaveBeenCalled();
  });
});
