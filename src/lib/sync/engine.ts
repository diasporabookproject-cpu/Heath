import { getSupabase } from '../supabase';
import {
  planPush,
  planPull,
  planAdopt,
  docKey,
  hashPayload,
  type LocalDoc,
  type RemoteDoc,
  type SyncStore,
} from './plan';
import { collectLocalDocs, applyRemote, applyDelete } from './map';
import {
  loadAllSyncMeta,
  putSyncMeta,
  delSyncMeta,
  loadSyncCursor,
  saveSyncCursor,
} from '../db';

// Moteur de sync (IO). Orchestration push/pull/adoption au-dessus du cœur pur
// (plan.ts) et du mapping (map.ts). LWW porté par `updated_at` SERVEUR ; jamais
// bloquant (best-effort, l'app marche hors-ligne).

const EPOCH = '1970-01-01T00:00:00Z';

interface DocRow {
  store: string;
  doc_id: string;
  payload: unknown;
  updated_at: string;
  deleted_at: string | null;
}

function toRemote(row: DocRow): RemoteDoc {
  return {
    store: row.store as SyncStore,
    docId: row.doc_id,
    payload: row.payload,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function maxIso(rows: RemoteDoc[], floor: string): string {
  return rows.reduce((mx, r) => (r.updatedAt > mx ? r.updatedAt : mx), floor);
}

/** Upsert d'un doc (payload ou tombstone) ; renvoie l'`updated_at` posé par le serveur. */
async function upsertDoc(
  foyerId: string,
  d: { store: string; docId: string; payload: unknown; deletedAt: string | null },
): Promise<{ updatedAt?: string; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'hors-ligne' };
  const { data, error } = await supa
    .from('docs')
    .upsert(
      {
        foyer_id: foyerId,
        store: d.store,
        doc_id: d.docId,
        payload: d.payload as Record<string, unknown> | null,
        deleted_at: d.deletedAt,
      },
      { onConflict: 'foyer_id,store,doc_id' },
    )
    .select('updated_at')
    .single();
  if (error) return { error: error.message };
  return { updatedAt: (data as { updated_at: string }).updated_at };
}

/** Pousse les changements locaux (dirty + tombstones) vers le cloud. */
export async function push(foyerId: string): Promise<{ pushed: number; error?: string }> {
  const [local, meta] = await Promise.all([collectLocalDocs(), loadAllSyncMeta()]);
  const plan = planPush(local, meta);
  let pushed = 0;
  for (const d of plan.upserts) {
    const res = await upsertDoc(foyerId, { store: d.store, docId: d.docId, payload: d.payload, deletedAt: null });
    if (res.error) return { pushed, error: res.error };
    await putSyncMeta(docKey(d), { syncedHash: hashPayload(d.payload), syncedAt: res.updatedAt! });
    pushed++;
  }
  for (const t of plan.tombstones) {
    const res = await upsertDoc(foyerId, { store: t.store, docId: t.docId, payload: null, deletedAt: new Date().toISOString() });
    if (res.error) return { pushed, error: res.error };
    await delSyncMeta(docKey(t));
    pushed++;
  }
  return { pushed };
}

/** Rapatrie les changements distants (delta par curseur) et les applique en local. */
export async function pull(foyerId: string): Promise<{ applied: number; changed: boolean; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { applied: 0, changed: false, error: 'hors-ligne' };
  const cursor = (await loadSyncCursor()) ?? EPOCH;
  const { data, error } = await supa
    .from('docs')
    .select('store,doc_id,payload,updated_at,deleted_at')
    .eq('foyer_id', foyerId)
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true });
  if (error) return { applied: 0, changed: false, error: error.message };
  const remote = (data as DocRow[]).map(toRemote);
  if (!remote.length) return { applied: 0, changed: false };

  const [local, meta] = await Promise.all([collectLocalDocs(), loadAllSyncMeta()]);
  const localByKey: Record<string, LocalDoc | undefined> = {};
  for (const d of local) localByKey[docKey(d)] = d;
  const plan = planPull(remote, localByKey, meta);

  for (const r of plan.applies) {
    await applyRemote(r.store, r.docId, r.payload);
    await putSyncMeta(docKey(r), { syncedHash: hashPayload(r.payload), syncedAt: r.updatedAt });
  }
  for (const d of plan.deletes) {
    await applyDelete(d.store, d.docId);
    await delSyncMeta(docKey(d));
  }
  await saveSyncCursor(maxIso(remote, cursor));
  const changed = plan.applies.length + plan.deletes.length > 0;
  return { applied: plan.applies.length + plan.deletes.length, changed };
}

/**
 * Adoption à la 1ʳᵉ connexion (Q1) : UNION local↔cloud. Adopte le cloud vivant en
 * local, téléverse le local-seul. Sur collision, le cloud gagne (filet = export S2).
 * Idempotence : à réserver au premier passage par foyer (cf. adoptIfNeeded, wiring).
 */
export async function adopt(foyerId: string): Promise<{ changed: boolean; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { changed: false, error: 'hors-ligne' };
  const [local, remoteRes] = await Promise.all([
    collectLocalDocs(),
    supa.from('docs').select('store,doc_id,payload,updated_at,deleted_at').eq('foyer_id', foyerId),
  ]);
  if (remoteRes.error) return { changed: false, error: remoteRes.error.message };
  const remote = (remoteRes.data as DocRow[]).map(toRemote);
  const plan = planAdopt(local, remote);

  for (const r of plan.adoptRemote) {
    await applyRemote(r.store, r.docId, r.payload);
    await putSyncMeta(docKey(r), { syncedHash: hashPayload(r.payload), syncedAt: r.updatedAt });
  }
  for (const d of plan.upload) {
    const res = await upsertDoc(foyerId, { store: d.store, docId: d.docId, payload: d.payload, deletedAt: null });
    if (res.error) return { changed: plan.adoptRemote.length > 0, error: res.error };
    await putSyncMeta(docKey(d), { syncedHash: hashPayload(d.payload), syncedAt: res.updatedAt! });
  }
  await saveSyncCursor(maxIso(remote, EPOCH));
  return { changed: plan.adoptRemote.length > 0 };
}

/** Cycle complet : push puis pull. Renvoie si le local a changé (→ rafraîchir l'UI). */
export async function syncNow(foyerId: string): Promise<{ changed: boolean; error?: string }> {
  const p = await push(foyerId);
  if (p.error) return { changed: false, error: p.error };
  const q = await pull(foyerId);
  return { changed: q.changed, error: q.error };
}
