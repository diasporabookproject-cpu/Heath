import { getSupabase } from './supabase';
import { getAccessToken, uploadWeekAudios } from './publish';
import { buildSharePayload, type SharedMenu } from './share';
import type { AppConfig, Destinataire, Recipe, WeekMenu } from '../types';

// Espace permanent par destinataire (keystone F1, cœur).
// Contenu stocké dans la table Supabase `espaces` (upsert en place, lecture
// publique par jeton = modèle « capability »). Les audios vont dans le bucket
// public `shared`. Lien permanent : .../#e=<token>.

export const ESPACE_PREFIX = '#e=';

export interface Espace {
  v: 1;
  langue: 'fr' | 'ar';
  nom: string;
  role: string;
  menu: SharedMenu;
}

/** Jeton d'accès long et non devinable (capability). */
export function newToken(): string {
  const uuid = () =>
    globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? Math.random().toString(36).slice(2);
  return (uuid() + uuid()).slice(0, 40);
}

export function buildEspaceUrl(token: string): string {
  return window.location.origin + window.location.pathname + ESPACE_PREFIX + token;
}

/** Publie / met à jour l'espace d'un destinataire avec le menu courant. */
export async function publishEspace(
  dest: Destinataire,
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
): Promise<{ url: string; audioCount: number }> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const token = await getAccessToken(); // exige une session (écriture connectée)

  // préfixe unique par publication (uploads en insert simple, pas d'écrasement)
  const prefix = `${dest.token}/${newToken().slice(0, 8)}`;
  const audioUrls = await uploadWeekAudios(config, week, prefix, token);

  const menu = buildSharePayload(config, week, byId, new Set(audioUrls.keys()), audioUrls);
  const payload: Espace = {
    v: 1,
    langue: dest.langue,
    nom: dest.nom,
    role: dest.role,
    menu,
  };

  const { error } = await supa
    .from('espaces')
    .upsert({ token: dest.token, payload, updated_at: new Date().toISOString() });
  if (error) throw new Error('Espace : ' + error.message);

  return { url: buildEspaceUrl(dest.token), audioCount: audioUrls.size };
}

/** Lit l'espace d'un jeton (côté destinataire, lecture publique anonyme). */
export async function readEspace(token: string): Promise<Espace | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { data, error } = await supa.from('espaces').select('payload').eq('token', token).maybeSingle();
  if (error || !data) return null;
  return data.payload as Espace;
}

/** Révoque l'espace (supprime le contenu côté serveur → l'ancien lien ne donne plus rien). */
export async function revokeEspace(token: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  await supa.from('espaces').delete().eq('token', token);
}

export function readEspaceToken(): string | null {
  const h = window.location.hash;
  if (!h.startsWith(ESPACE_PREFIX)) return null;
  const t = h.slice(ESPACE_PREFIX.length).trim();
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
}
