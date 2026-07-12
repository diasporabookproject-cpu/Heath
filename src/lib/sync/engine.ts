import { getSupabase } from '../supabase';
import {
  planPush,
  planPull,
  planAdopt,
  nextCursor,
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
// bloquant (best-effort, l'app marche hors-ligne). Écritures BATCHÉES (une
// requête pour N docs — FIX revue Q, efficacité) ; curseur PAR FOYER (FIX n°5) ;
// le curseur n'avance jamais au-delà d'un doc sauté par G2 (FIX n°8).

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

/**
 * Upsert BATCHÉ de docs (payloads et/ou tombstones) ; renvoie les `updated_at`
 * posés par le serveur, indexés par clé de doc.
 */
async function upsertDocs(
  foyerId: string,
  docs: { store: string; docId: string; payload: unknown; deletedAt: string | null }[],
): Promise<{ stamps?: Record<string, string>; error?: string }> {
  if (!docs.length) return { stamps: {} };
  const supa = getSupabase();
  if (!supa) return { error: 'hors-ligne' };
  const rows = docs.map((d) => ({
    foyer_id: foyerId,
    store: d.store,
    doc_id: d.docId,
    payload: d.payload as Record<string, unknown> | null,
    deleted_at: d.deletedAt,
  }));
  const { data, error } = await supa
    .from('docs')
    .upsert(rows, { onConflict: 'foyer_id,store,doc_id' })
    .select('store,doc_id,updated_at');
  if (error) return { error: error.message };
  const stamps: Record<string, string> = {};
  for (const r of data as { store: string; doc_id: string; updated_at: string }[]) {
    stamps[r.store + ':' + r.doc_id] = r.updated_at;
  }
  return { stamps };
}

/** Pousse les changements locaux (dirty + tombstones) vers le cloud. */
export async function push(foyerId: string): Promise<{ pushed: number; error?: string }> {
  const [local, meta] = await Promise.all([collectLocalDocs(), loadAllSyncMeta()]);
  const plan = planPush(local, meta);
  const res = await upsertDocs(foyerId, [
    ...plan.upserts.map((d) => ({ store: d.store, docId: d.docId, payload: d.payload, deletedAt: null })),
    ...plan.tombstones.map((t) => ({ store: t.store, docId: t.docId, payload: null, deletedAt: new Date().toISOString() })),
  ]);
  if (res.error) return { pushed: 0, error: res.error };
  for (const d of plan.upserts) {
    const at = res.stamps![docKey(d)];
    if (at) await putSyncMeta(docKey(d), { syncedHash: hashPayload(d.payload), syncedAt: at });
  }
  for (const t of plan.tombstones) await delSyncMeta(docKey(t));
  return { pushed: plan.upserts.length + plan.tombstones.length };
}

/** Rapatrie les changements distants (delta par curseur) et les applique en local. */
export async function pull(foyerId: string): Promise<{ applied: number; changed: boolean; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { applied: 0, changed: false, error: 'hors-ligne' };
  const cursor = (await loadSyncCursor(foyerId)) ?? EPOCH;
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
  // FIX n°8 : ne jamais avancer le curseur au-delà d'un doc sauté (G2) — il sera
  // re-servi au prochain pull tant que le doc local reste dirty non poussé.
  await saveSyncCursor(foyerId, nextCursor(remote, plan.skipped, cursor));
  const changed = plan.applies.length + plan.deletes.length > 0;
  return { applied: plan.applies.length + plan.deletes.length, changed };
}

/** Le foyer a-t-il déjà des documents dans le cloud ? (null si indéterminable). */
export async function remoteHasDocs(foyerId: string): Promise<boolean | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { count, error } = await supa
    .from('docs')
    .select('doc_id', { count: 'exact', head: true })
    .eq('foyer_id', foyerId)
    .is('deleted_at', null);
  if (error) return null;
  return (count ?? 0) > 0;
}

/**
 * Adoption (Q1) : UNION local↔cloud. Adopte le cloud vivant en local, téléverse
 * le local-seul (batché). Sur collision, le cloud gagne (filet = export S2).
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

  // F5a-② (option b) : le contenu de PACK local en doublon de nom avec le foyer
  // n'est ni téléversé ni gardé — supprimé ici, puis REMPLACÉ par le jumeau du
  // foyer (ré-écrit juste en dessous par adoptRemote, sous le docId du foyer).
  for (const ref of plan.dropLocal) await applyDelete(ref.store, ref.docId);

  for (const r of plan.adoptRemote) {
    await applyRemote(r.store, r.docId, r.payload);
    await putSyncMeta(docKey(r), { syncedHash: hashPayload(r.payload), syncedAt: r.updatedAt });
  }
  const up = await upsertDocs(
    foyerId,
    plan.upload.map((d) => ({ store: d.store, docId: d.docId, payload: d.payload, deletedAt: null })),
  );
  if (up.error) return { changed: plan.adoptRemote.length > 0, error: up.error };
  for (const d of plan.upload) {
    const at = up.stamps![docKey(d)];
    if (at) await putSyncMeta(docKey(d), { syncedHash: hashPayload(d.payload), syncedAt: at });
  }
  await saveSyncCursor(foyerId, nextCursor(remote, [], EPOCH));
  return { changed: plan.adoptRemote.length > 0 };
}

/** Cycle complet : push puis pull. Renvoie si le local a changé (→ rafraîchir l'UI). */
export async function syncNow(foyerId: string): Promise<{ changed: boolean; error?: string }> {
  const p = await push(foyerId);
  if (p.error) return { changed: false, error: p.error };
  const q = await pull(foyerId);
  return { changed: q.changed, error: q.error };
}
