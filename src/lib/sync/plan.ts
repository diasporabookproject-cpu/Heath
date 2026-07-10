// Cœur PUR du moteur de sync (aucun IO, entièrement testable). Porte les décisions
// à risque : dirty par hash de contenu, LWW, tombstones, garde anti-écrasement (G2),
// fusion d'adoption (Q1). L'IO (Supabase + IndexedDB) est dans engine.ts.

export type SyncStore =
  | 'recipes'
  | 'weeks'
  | 'destinataires'
  | 'securite'
  | 'nounou'
  | 'app'
  | 'settings';

/** Référence d'un document synchronisable. */
export interface DocRef {
  store: SyncStore;
  docId: string;
}

/** Document local (contenu présent dans IndexedDB). */
export interface LocalDoc extends DocRef {
  payload: unknown;
}

/** Document distant (ligne de la table `docs`). */
export interface RemoteDoc extends DocRef {
  payload: unknown;
  updatedAt: string; // ISO, POSÉ PAR LE SERVEUR (clé du LWW)
  deletedAt: string | null; // tombstone
}

/** Méta de sync par document, persistée localement. */
export interface DocMeta {
  syncedHash: string; // hash du payload au dernier push/pull réussi
  syncedAt: string; // updated_at serveur correspondant
}

export type MetaIndex = Record<string, DocMeta>; // clé = docKey()

export function docKey(ref: DocRef): string {
  return ref.store + ':' + ref.docId;
}

/** Reconstruit une DocRef depuis une clé (le store ne contient jamais ':'). */
export function refFromKey(key: string): DocRef {
  const i = key.indexOf(':');
  return { store: key.slice(0, i) as SyncStore, docId: key.slice(i + 1) };
}

/**
 * Sérialisation CANONIQUE : clés d'objets triées récursivement. Le hash ne dépend
 * plus de l'ordre des clés — Postgres `jsonb` réordonne au stockage et
 * `loadSettings`/`loadApp` reconstruisent par spread, ce qui faisait ressortir
 * `settings`/`app` faussement « dirty » après chaque pull (ping-pong entre appareils).
 * `undefined` est ignoré comme le fait `JSON.stringify`.
 */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
}

/**
 * Hash stable d'un payload : FNV-1a **64 bits** sur la forme canonique. 64 bits
 * (vs djb2 32 bits) réduit le risque de collision qui laisserait une édition réelle
 * passer pour « propre » et jamais poussée (divergence silencieuse — finding revue).
 * ⚠️ Changer d'algo invalide les `syncedHash` déjà persistés ⇒ UNE vague de re-push
 * au déploiement (contenu identique, converge après un push ; documenté au DEVLOG).
 */
export function hashPayload(payload: unknown): string {
  const s = canonical(payload);
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(36);
}

/** Un doc local est « dirty » si son contenu diffère du dernier état synchronisé. */
export function isDirty(doc: LocalDoc, meta: MetaIndex): boolean {
  const m = meta[docKey(doc)];
  return !m || m.syncedHash !== hashPayload(doc.payload);
}

// ── PUSH ────────────────────────────────────────────────────────────────────
export interface PushPlan {
  upserts: LocalDoc[]; // docs nouveaux/modifiés à pousser
  tombstones: DocRef[]; // docs autrefois synchronisés, disparus localement
}

/**
 * Plan de push : docs locaux dirty + tombstones (présents en méta, absents en local).
 * Ne pousse jamais un doc déjà à jour.
 */
export function planPush(local: LocalDoc[], meta: MetaIndex): PushPlan {
  const upserts = local.filter((d) => isDirty(d, meta));
  const localKeys = new Set(local.map(docKey));
  const tombstones = Object.keys(meta)
    .filter((k) => !localKeys.has(k))
    .map(refFromKey);
  return { upserts, tombstones };
}

// ── PULL ────────────────────────────────────────────────────────────────────
export interface PullPlan {
  applies: RemoteDoc[]; // payload distant à écrire en local
  deletes: DocRef[]; // tombstones distants à appliquer en local
  skipped: RemoteDoc[]; // ignorés : doc local dirty (garde anti-écrasement, G2)
}

/**
 * Plan de pull avec LWW + garde anti-écrasement (G2).
 * - remote pas plus récent que notre `syncedAt` → ignoré (delta déjà connu).
 * - doc local DIRTY (édité non poussé) → SKIP (G2) : jamais écrasé par un pull.
 * - sinon tombstone → delete (si présent en local) ; payload → apply.
 */
export function planPull(
  remote: RemoteDoc[],
  localByKey: Record<string, LocalDoc | undefined>,
  meta: MetaIndex,
): PullPlan {
  const applies: RemoteDoc[] = [];
  const deletes: DocRef[] = [];
  const skipped: RemoteDoc[] = [];
  for (const r of remote) {
    const k = docKey(r);
    const m = meta[k];
    if (m && r.updatedAt <= m.syncedAt) continue; // rien de nouveau
    const localDoc = localByKey[k];
    if (localDoc && isDirty(localDoc, meta)) {
      skipped.push(r); // G2 : le local dirty gagne, il partira au prochain push
      continue;
    }
    if (r.deletedAt) {
      if (localDoc) deletes.push(r);
      // sinon déjà absent : rien à faire
    } else {
      applies.push(r);
    }
  }
  return { applies, deletes, skipped };
}

/**
 * Prochain curseur de pull (FIX revue Q n°8). Le curseur n'avance JAMAIS au-delà
 * d'un doc sauté par la garde G2 : il s'arrête juste avant le plus ancien doc
 * sauté, qui sera donc re-servi au prochain pull (jusqu'à ce que le doc local
 * cesse d'être dirty — poussé OU revenu à l'état synchronisé).
 */
export function nextCursor(remote: RemoteDoc[], skipped: RemoteDoc[], cursor: string): string {
  if (!skipped.length) {
    return remote.reduce((mx, r) => (r.updatedAt > mx ? r.updatedAt : mx), cursor);
  }
  const minSkipped = skipped.reduce((mn, r) => (r.updatedAt < mn ? r.updatedAt : mn), skipped[0].updatedAt);
  return remote
    .filter((r) => r.updatedAt < minSkipped)
    .reduce((mx, r) => (r.updatedAt > mx ? r.updatedAt : mx), cursor);
}

// ── ADOPTION (Q1) ────────────────────────────────────────────────────────────
export interface AdoptPlan {
  upload: LocalDoc[]; // docs présents seulement en local → téléversés
  adoptRemote: RemoteDoc[]; // docs distants vivants → écrits en local (collision incluse)
}

/**
 * Fusion à la 1ʳᵉ connexion : UNION par (store, docId).
 * - local seul → upload.
 * - remote seul → adopte en local.
 * - collision → LWW ; sans horloge locale fiable, le CLOUD gagne (foyer déjà
 *   établi par un autre appareil). Filet : l'export JSON préalable (S2). Documenté.
 *   Les tombstones distants sont ignorés à l'adoption.
 */
export function planAdopt(local: LocalDoc[], remote: RemoteDoc[]): AdoptPlan {
  const remoteKeys = new Set(remote.map(docKey));
  const upload = local.filter((d) => !remoteKeys.has(docKey(d)));
  const adoptRemote = remote.filter((r) => !r.deletedAt);
  return { upload, adoptRemote };
}
