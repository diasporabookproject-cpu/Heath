import { getSupabase } from './supabase';
import { currentFoyerId } from './auth';
import { webBaseUrl } from './platform';
import { getAccessToken, uploadAudios, uploadWeekAudios } from './publish';
import { buildEspaceMenu, usedRecipeIds, type SharedMenu } from './share';
import { loadAudio, loadFoyerRegles, loadSecurite, recordPublished } from './db';
import { cuisineSig } from '../maison/transmission';
import { translateToDarija } from './ai';
import { DEFAULT_SETTINGS, wireLangue, type AppConfig, type Destinataire, type Recipe, type SecuriteType, type WeekMenu } from '../types';

// Espace permanent par destinataire (keystone F1, cœur).
// Contenu stocké dans la table Supabase `espaces` (upsert en place, lecture
// publique par jeton = modèle « capability »). Les audios vont dans le bucket
// public `shared`. Lien permanent : .../#e=<token>.

export const ESPACE_PREFIX = '#e=';
const TRANSLATE_CAP = 12; // plafond d'appels de traduction par envoi (coût)

export interface SecuritePublic {
  type: SecuriteType;
  titre: string;
  titre_ar?: string;
  contenu: string;
  contenu_ar?: string;
  a?: string; // URL publique de la note vocale du parent
}

export interface Espace {
  v: 1;
  /** Contrat du FIL v:1 — `'ar'` = DARIJA (perpétuel, liens distribués) ; l'arabe
   *  standard n'a pas de code ici : D5 passera par `v: 2` (ETAT.md § Ouvert). */
  langue: 'fr' | 'ar';
  nom: string;
  role: string;
  /** Nombre de personnes pour la mise à l'échelle des ingrédients. */
  persons?: number;
  menu: SharedMenu;
  securite?: SecuritePublic[];
}

/** Jeton d'accès long et non devinable (capability). */
export function newToken(): string {
  const uuid = () =>
    globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? Math.random().toString(36).slice(2);
  return (uuid() + uuid()).slice(0, 40);
}

export function buildEspaceUrl(token: string): string {
  // URL WEB publique (via platform.ts) : en natif, origin serait https://localhost
  // → lien mort pour le destinataire (8ᵉ piège, read-back C0).
  return webBaseUrl() + ESPACE_PREFIX + token;
}

/**
 * Pour un envoi en darija : complète les champs darija manquants des recettes
 * utilisées via l'edge function de traduction (figée dans l'espace). Best-effort,
 * plafonné, jamais bloquant ; renvoie une map enrichie sans toucher la base.
 */
async function augmentDarija(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
): Promise<Map<string, Recipe>> {
  const out = new Map(byId);
  const toTranslate = usedRecipeIds(config, week)
    .map((id) => byId.get(id))
    .filter((r): r is Recipe => !!r)
    .filter((r) => !r.nom_ar || !r.ingredients_ar || (r.etapes && !r.etapes_ar))
    .slice(0, TRANSLATE_CAP);

  await Promise.all(
    toTranslate.map(async (r) => {
      const tr = await translateToDarija({
        nom: r.nom_ar ? undefined : r.nom,
        ingredients: r.ingredients_ar ? undefined : r.ingredients,
        etapes: r.etapes && !r.etapes_ar ? r.etapes : undefined,
      });
      if (!tr) return;
      out.set(r.id, {
        ...r,
        nom_ar: r.nom_ar || tr.nom_ar,
        ingredients_ar: r.ingredients_ar || tr.ingredients_ar,
        etapes_ar: r.etapes_ar || tr.etapes_ar,
      });
    }),
  );
  return out;
}

async function buildSecurite(
  dest: Destinataire,
  prefix: string | null,
  token: string | null,
): Promise<SecuritePublic[]> {
  const assigned = new Set(dest.securiteIds ?? []);
  const fiches = (await loadSecurite()).filter((f) => f.statut === 'Validé' && assigned.has(f.id));
  if (fiches.length === 0) return [];
  let secAudio = new Map<string, string>();
  if (prefix && token) {
    secAudio = await uploadAudios(fiches.map((f) => f.id), `${prefix}/sec`, token);
  } else {
    // aperçu local : URLs d'objets locaux
    for (const f of fiches) {
      const blob = await loadAudio(f.id);
      if (blob) secAudio.set(f.id, URL.createObjectURL(blob));
    }
  }
  return fiches.map((f) => ({
    type: f.type,
    titre: f.titre,
    titre_ar: f.titre_ar,
    contenu: f.contenu,
    contenu_ar: f.contenu_ar,
    a: secAudio.get(f.id),
  }));
}

/** Publie / met à jour l'espace d'un destinataire avec le menu courant. */
export async function publishEspace(
  dest: Destinataire,
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  persons: number = DEFAULT_SETTINGS.persons,
): Promise<{ url: string; audioCount: number }> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const token = await getAccessToken(); // exige une session (écriture connectée)

  // préfixe unique par publication (uploads en insert simple, pas d'écrasement)
  const prefix = `${dest.token}/${newToken().slice(0, 8)}`;
  const audioUrls = await uploadWeekAudios(config, week, prefix, token);

  // Traduction darija figée (best-effort) si le destinataire lit en darija.
  const recipes = dest.langue === 'dr' ? await augmentDarija(config, week, byId) : byId;
  // F5.5 : alertes allergènes du FOYER (règles T3) calculées À LA PUBLICATION —
  // page vivante : une règle ajoutée se reflète au prochain envoi.
  const regles = await loadFoyerRegles();
  const menu = buildEspaceMenu(config, week, recipes, audioUrls, regles?.nePasManger);
  const securite = await buildSecurite(dest, prefix, token);

  const payload: Espace = {
    v: 1,
    langue: wireLangue(dest.langue), // fil v:1 : la darija voyage en 'ar' (perpétuel)
    nom: dest.nom,
    role: dest.role,
    persons,
    menu,
    securite,
  };

  // Tenancy (S6) : rattache l'espace au foyer → gestion/révocation côté auteur, et
  // suppression du foyer = coupe les liens (cascade, migration 0002).
  // FIX revue Q n°2 : TOLÉRANT à la colonne absente (0002 pas encore appliquée en
  // prod) — on retente sans `foyer_id` plutôt que de casser toute publication.
  // Un foyer_id manquant (null / colonne absente) se répare au prochain publish
  // (upsert) une fois 0002 jouée et le foyer résolu.
  const foyer_id = await currentFoyerId();
  const base = { token: dest.token, payload, updated_at: new Date().toISOString() };
  let { error } = await supa.from('espaces').upsert({ ...base, foyer_id });
  if (error && /foyer_id/i.test(error.message)) {
    ({ error } = await supa.from('espaces').upsert(base));
  }
  if (error) throw new Error('Espace : ' + error.message);

  // Trace de transmission (état « à envoyer », L1-4).
  await recordPublished(dest.token, cuisineSig(week, persons, dest));

  return { url: buildEspaceUrl(dest.token), audioCount: audioUrls.size };
}

/** Aperçu local de l'espace (sans upload ni réseau) — pour « Voir l'aperçu » (FC9). */
export async function previewEspace(
  dest: Destinataire,
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  persons: number = DEFAULT_SETTINGS.persons,
): Promise<Espace> {
  // audios locaux → object URLs jouables dans l'aperçu
  const audioUrls = new Map<string, string>();
  for (const id of usedRecipeIds(config, week)) {
    const blob = await loadAudio(id);
    if (blob) audioUrls.set(id, URL.createObjectURL(blob));
  }
  const regles = await loadFoyerRegles(); // F5.5 : l'aperçu montre les mêmes alertes
  const menu = buildEspaceMenu(config, week, byId, audioUrls, regles?.nePasManger);
  const securite = await buildSecurite(dest, null, null);
  return {
    v: 1,
    langue: wireLangue(dest.langue), // même contrat que publishEspace (l'aperçu = la page)
    nom: dest.nom,
    role: dest.role,
    persons,
    menu,
    securite,
  };
}

/**
 * Résultat de lecture d'un espace (audit §7.8 ④). On DISTINGUE trois cas que
 * l'ancien `Espace | null` écrasait — d'où le trou : une page révoquée était
 * servie depuis le cache comme une page hors-ligne.
 *  - `found`       : la ligne existe (requête réussie, payload présent).
 *  - `revoked`     : requête RÉUSSIE, AUCUNE ligne → le lien a été coupé (F1).
 *  - `unreachable` : pas de client / erreur réseau → l'offline légitime.
 */
export type EspaceRead = { status: 'found'; espace: Espace } | { status: 'revoked' } | { status: 'unreachable' };

/** Lit l'espace d'un jeton (côté destinataire, lecture publique anonyme). */
export async function readEspace(token: string): Promise<EspaceRead> {
  const supa = getSupabase();
  if (!supa) return { status: 'unreachable' };
  const { data, error } = await supa.from('espaces').select('payload').eq('token', token).maybeSingle();
  if (error) return { status: 'unreachable' }; // réseau/erreur → le cache reste légitime
  if (!data) return { status: 'revoked' }; // requête OK, 0 ligne → révoqué
  return { status: 'found', espace: data.payload as Espace };
}

/**
 * ④ (audit §7.8) — décision PURE d'affichage à partir du statut réseau et de la
 * présence d'un cache local. Le point dur, verrouillé ici : une page `revoked`
 * ne doit JAMAIS être servie depuis le cache (complément client de F1) ; seul
 * l'`unreachable` (offline) sert le cache. L'appelant PURGE le cache sur 'revoked'.
 */
export function decideEspaceState(
  status: EspaceRead['status'],
  hasCache: boolean,
): 'page-live' | 'page-cache' | 'revoked' | 'offline' {
  if (status === 'found') return 'page-live';
  if (status === 'revoked') return 'revoked'; // le cache éventuel est ignoré (et purgé par l'appelant)
  return hasCache ? 'page-cache' : 'offline';
}

/**
 * Journalise une ouverture de l'espace (accusé de lecture, FC9). Best-effort :
 * nécessite la table publique `espace_opens` (sinon ignoré silencieusement).
 */
export async function logEspaceOpen(token: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  try {
    await supa.from('espace_opens').insert({ token, opened_at: new Date().toISOString() });
  } catch {
    /* table absente / non autorisée : on n'empêche jamais la lecture */
  }
}

/** Dernière ouverture connue d'un espace (ISO) ou null. */
export async function lastEspaceOpen(token: string): Promise<string | null> {
  const supa = getSupabase();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from('espace_opens')
      .select('opened_at')
      .eq('token', token)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { opened_at: string }).opened_at;
  } catch {
    return null;
  }
}

/**
 * Révoque l'espace (supprime la ligne côté serveur → l'ancien lien ne donne plus rien).
 *
 * VÉRITÉ (mini-lot destinataires, F1) — succès = le serveur a RÉPONDU sans erreur,
 * JAMAIS le rowcount : une personne jamais partagée n'a pas de ligne `espaces`
 * (0 ligne = « rien à couper », pas un échec). Échec = on ne l'a pas joint
 * (hors-ligne, session absente, erreur serveur).
 * La session est exigée AVANT l'appel : la policy delete d'`espaces` (0006) est
 * `to authenticated` + membre du foyer — sans session, RLS filtre EN SILENCE
 * (200, 0 ligne, aucune erreur) et on retomberait dans le faux succès.
 * Le local-first vaut pour le contenu, pas le contrôle d'accès : la vérité de
 * « qui peut lire » vit là où le jeton est vérifié → « Retirer » exige la connexion.
 */
export async function revokeEspace(token: string): Promise<{ error?: 'session' | 'serveur' }> {
  const supa = getSupabase();
  if (!supa) return { error: 'session' };
  try {
    const { data } = await supa.auth.getSession();
    if (!data.session) return { error: 'session' };
    const { error } = await supa.from('espaces').delete().eq('token', token);
    if (error) return { error: 'serveur' };
    return {};
  } catch {
    return { error: 'serveur' };
  }
}

export function readEspaceToken(): string | null {
  const h = window.location.hash;
  if (!h.startsWith(ESPACE_PREFIX)) return null;
  const t = h.slice(ESPACE_PREFIX.length).trim();
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
}
