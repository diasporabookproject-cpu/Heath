import { getSupabase } from '../lib/supabase';
import { getAccessToken, uploadAudios } from '../lib/publish';
import { buildEspaceUrl } from '../lib/espace';
import { loadAudioKeys, recordPublished } from '../lib/db';
import { hashStr } from '../lib/hash';
import { newToken } from './defaults';
import type { Enfant, Moment, NounouDest, NounouDoc, NounouLangue, Periode } from '../types';

// Partage de la page Nounou : payload scopé au destinataire (ses enfants, son
// rôle, sa langue), publié dans la table `espaces` (même mécanique capability que
// la Cuisine). Mise à jour EN PLACE sur le même jeton → le lien reste durable.
// La traduction (FN4.2) viendra plus tard ; pour l'instant le contenu est figé
// dans la langue d'auteur (français), avec la langue cible portée en métadonnée.

export interface NounouEspace {
  kind: 'nounou';
  v: 1;
  langue: NounouLangue;
  nom: string;
  role: string;
  /** Document scopé (enfants du destinataire + moments les concernant). */
  doc: NounouDoc;
  /** Traductions actives figées (texte source → traduction). Vide en français. */
  trans?: Record<string, string>;
  publishedAt: string;
}

/**
 * Traductions diffusées pour une langue → map figée. On envoie TOUT le traduit
 * (planning + sensible), même non relu : la relecture du sensible est un rappel,
 * pas un blocage (décision produit Amine, MVP). Seules les entrées vides/rejetées
 * (absentes) retombent sur le français.
 */
function activeTranslations(doc: NounouDoc, langue: NounouLangue): Record<string, string> {
  const out: Record<string, string> = {};
  if (langue === 'fr') return out;
  const cache = doc.translations?.[langue] ?? {};
  for (const [src, e] of Object.entries(cache)) {
    if (e.tr.trim()) out[src] = e.tr;
  }
  return out;
}

/** Un moment concerne-t-il au moins un enfant scopé ? (vide = tous → oui) */
function concernsScope(enfants: string[], scope: Set<string> | null): boolean {
  if (!scope) return true; // pas de scope = tous les enfants
  if (enfants.length === 0) return true; // moment « tous »
  return enfants.some((id) => scope.has(id));
}

function scopeMoment(m: Moment, scope: Set<string> | null): Moment {
  if (!scope) return m;
  return { ...m, enfants: m.enfants.filter((id) => scope.has(id)) };
}

/** Construit le document scopé pour un destinataire. */
export function buildScopedDoc(doc: NounouDoc, dest: NounouDest): NounouDoc {
  const scope = dest.enfants.length > 0 ? new Set(dest.enfants) : null;
  const enfants: Enfant[] = scope ? doc.enfants.filter((e) => scope.has(e.id)) : doc.enfants;

  const filterMoments = (list: Moment[]) =>
    list.filter((m) => concernsScope(m.enfants, scope)).map((m) => scopeMoment(m, scope));

  const periodes: Periode[] = doc.periodes.map((p) => ({ ...p, rythme: filterMoments(p.rythme) }));

  return {
    enfants,
    rythme: filterMoments(doc.rythme),
    periodes,
    ponctuels: doc.ponctuels
      .filter((p) => concernsScope(p.enfants, scope))
      .map((p) => (scope ? { ...p, enfants: p.enfants.filter((id) => scope.has(id)) } : p)),
    conduites: doc.conduites,
    urgence: doc.urgence,
    destinataires: [], // jamais exposé côté reçu
  };
}

export function buildNounouEspace(doc: NounouDoc, dest: NounouDest, publishedAt: string): NounouEspace {
  const scoped = buildScopedDoc(doc, dest);
  scoped.translations = undefined; // la map figée `trans` suffit côté reçu
  return {
    kind: 'nounou',
    v: 1,
    langue: dest.langue,
    nom: dest.prenom,
    role: dest.role,
    doc: scoped,
    trans: activeTranslations(doc, dest.langue),
    publishedAt,
  };
}

/** Signature du contenu Nounou scopé + traductions figées (hors horodatage), pour l'état de transmission. */
export function nounouSig(doc: NounouDoc, dest: NounouDest): string {
  const { publishedAt: _drop, ...rest } = buildNounouEspace(doc, dest, '');
  void _drop;
  return hashStr(JSON.stringify(rest));
}

/** Publie / met à jour en place l'espace d'un destinataire. */
export async function publishNounouEspace(
  doc: NounouDoc,
  dest: NounouDest,
): Promise<{ url: string }> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const token = await getAccessToken(); // exige une session (écriture connectée)

  const payload = buildNounouEspace(doc, dest, new Date().toISOString());

  // Consignes vocales des conduites (la voix du parent) → bucket public `shared`,
  // figées dans le payload (URL) pour la lecture côté destinataire.
  const audioKeys = new Set(await loadAudioKeys());
  const withVoix = payload.doc.conduites.filter((c) => !c.aCompleter && audioKeys.has(c.id));
  if (withVoix.length) {
    const prefix = `${dest.token}/${newToken().slice(0, 8)}`;
    const urls = await uploadAudios(withVoix.map((c) => c.id), prefix, token);
    payload.doc.conduites = payload.doc.conduites.map((c) =>
      urls.has(c.id) ? { ...c, voix: urls.get(c.id) } : c,
    );
  }

  const { error } = await supa
    .from('espaces')
    .upsert({ token: dest.token, payload, updated_at: new Date().toISOString() });
  if (error) throw new Error('Espace : ' + error.message);

  // Trace de transmission (état « à envoyer », L1-4).
  await recordPublished(dest.token, nounouSig(doc, dest));

  return { url: buildEspaceUrl(dest.token) };
}

/** Aperçu local (sans réseau) du payload scopé. */
export function previewNounouEspace(doc: NounouDoc, dest: NounouDest): NounouEspace {
  return buildNounouEspace(doc, dest, new Date().toISOString());
}
