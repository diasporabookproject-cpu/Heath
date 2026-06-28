import { getSupabase } from '../lib/supabase';
import { getAccessToken, uploadAudios } from '../lib/publish';
import { buildEspaceUrl } from '../lib/espace';
import { loadAudioKeys } from '../lib/db';
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
  publishedAt: string;
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
  return {
    kind: 'nounou',
    v: 1,
    langue: dest.langue,
    nom: dest.prenom,
    role: dest.role,
    doc: buildScopedDoc(doc, dest),
    publishedAt,
  };
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
  // figées dans le payload (URL) pour la lecture côté employée.
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

  return { url: buildEspaceUrl(dest.token) };
}

/** Aperçu local (sans réseau) du payload scopé. */
export function previewNounouEspace(doc: NounouDoc, dest: NounouDest): NounouEspace {
  return buildNounouEspace(doc, dest, new Date().toISOString());
}
