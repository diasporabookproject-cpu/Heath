import { getSupabase } from './supabase';
import { clearCompteLie, clearSyncState, saveMonPrenom } from './db';
import { webBaseUrl } from './platform';

// Auth OTP par e-mail (code 6 chiffres) + foyer paresseux + suppression de compte.
// Lot Identité & accès (T1) : le compte est REQUIS — le mur précède l'app. Ce qui a
// changé est QUAND on le demande, pas comment ; la méthode OTP est intacte. La SESSION
// vivante, elle, ne conditionne que les opérations réseau (sync, publication, IA),
// toutes best-effort : hors-ligne l'app reste entière (drapeau local `compteLie`).
// Identité = compte Manzil (jamais un ID de store).

/**
 * Pourquoi l'envoi a échoué. Sans cette distinction, un **plafond de débit** (le cas
 * de loin le plus fréquent : deux demandes rapprochées, ou le même e-mail réutilisé)
 * s'affichait comme « vérifiez votre connexion » — un conseil faux, qui envoie
 * chercher le problème là où il n'est pas. Retour device : « pas de code reçu ».
 */
export type OtpFailure = 'debit' | 'reseau';

/** Envoie un code de connexion à l'e-mail (crée l'utilisateur si besoin). */
export async function sendOtp(email: string): Promise<{ error?: string; cause?: OtpFailure }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.', cause: 'reseau' };
  const { error } = await supa.auth.signInWithOtp({
    email: email.trim(),
    // Redirige le lien magique vers l'app (utile tant que l'e-mail n'a pas de code
    // à 6 chiffres — nécessite un SMTP perso pour éditer le modèle). Le retour du
    // lien ouvre la session via detectSessionInUrl. URL WEB publique via platform.ts :
    // couvre le base path /Heath/ en prod (FIX revue Q n°3) ET le natif (origin =
    // https://localhost serait un lien mort — le lien renvoie alors au web).
    options: {
      shouldCreateUser: true,
      emailRedirectTo: webBaseUrl(),
    },
  });
  if (!error) return {};
  return { error: error.message, cause: causeOtp(error) };
}

/** Lit la cause d'un échec d'envoi d'OTP. Supabase répond `429` sur le plafond de
 * débit, et son message le dit en clair (« you can only request this after N
 * seconds », « email rate limit exceeded ») — on ne devine pas, on reconnaît. */
export function causeOtp(error: { status?: number; message?: string }): OtpFailure {
  if (error.status === 429) return 'debit';
  return /rate limit|only request this after|too many/i.test(error.message ?? '') ? 'debit' : 'reseau';
}

/** Vérifie le code 6 chiffres et ouvre la session. */
export async function verifyOtp(email: string, token: string): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { error } = await supa.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
  return error ? { error: error.message } : {};
}

/**
 * Garantit que l'utilisateur connecté a un foyer (création paresseuse, atomique
 * via le RPC `create_foyer`). Renvoie l'id du foyer. Idempotent : un utilisateur
 * qui a déjà un foyer récupère le sien (contrainte `unique(user_id)` côté schéma).
 */
export async function ensureFoyer(): Promise<{ foyerId?: string; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data: userData } = await supa.auth.getUser();
  const user = userData.user;
  if (!user) return { error: 'Non connecté.' };

  const { data: rows, error: selErr } = await supa
    .from('membres')
    .select('foyer_id')
    .eq('user_id', user.id)
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (rows && rows.length) return { foyerId: rows[0].foyer_id as string };

  const { data: fid, error: rpcErr } = await supa.rpc('create_foyer');
  if (rpcErr) return { error: rpcErr.message };
  return { foyerId: fid as string };
}

/**
 * Id du foyer de l'utilisateur connecté (null si non connecté / pas de foyer).
 * Cache par utilisateur (le foyer est stable pour une session — FIX revue Q,
 * efficacité) ; une ERREUR de requête ne renvoie plus un faux « pas de foyer »
 * mais laisse le cache/`null` explicite (FIX n°2, espaces non rattachés).
 */
let foyerCache: { userId: string; foyerId: string } | null = null;

export function invalidateFoyerCache(): void {
  foyerCache = null;
}

export async function currentFoyerId(): Promise<string | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { data: u } = await supa.auth.getUser();
  if (!u.user) return null;
  if (foyerCache && foyerCache.userId === u.user.id) return foyerCache.foyerId;
  const { data, error } = await supa
    .from('membres')
    .select('foyer_id')
    .eq('user_id', u.user.id)
    .limit(1);
  if (error) return null; // transitoire : pas de cache posé, re-tenté au prochain appel
  const foyerId = (data?.[0]?.foyer_id as string) ?? null;
  if (foyerId) foyerCache = { userId: u.user.id, foyerId };
  return foyerId;
}

/**
 * Quitte le foyer courant. FIX revue Q n°1 : un OWNER ne laisse jamais un foyer
 * orphelin — seul membre ⇒ le foyer (et son contenu cloud) est supprimé (cascade) ;
 * d'autres membres ⇒ refus explicite (transfert de propriété = hors v1).
 * Au rechargement, un foyer neuf est recréé.
 */
export async function leaveFoyer(): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data: u } = await supa.auth.getUser();
  if (!u.user) return { error: 'Non connecté.' };
  const { data: mem, error: memErr } = await supa
    .from('membres')
    .select('foyer_id, role')
    .eq('user_id', u.user.id)
    .limit(1);
  if (memErr) return { error: memErr.message };
  const m = mem?.[0];
  if (!m) return {}; // déjà sans foyer
  if (m.role === 'owner') {
    const { count } = await supa
      .from('membres')
      .select('user_id', { count: 'exact', head: true })
      .eq('foyer_id', m.foyer_id);
    if ((count ?? 1) > 1) {
      return { error: 'Votre foyer a d’autres membres — retirez-les d’abord (ou supprimez le foyer).' };
    }
    const { error } = await supa.from('foyers').delete().eq('id', m.foyer_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supa.from('membres').delete().eq('user_id', u.user.id);
    if (error) return { error: error.message };
  }
  invalidateFoyerCache();
  await clearSyncState();
  return {};
}

/** Aperçu d'une invitation AVANT de la rejoindre (RPC `preview_invite`, 0013).
 * Lecture seule : ne consomme rien, ne joint rien. Un code mort renvoie `ok:false`
 * NU (pas d'oracle) — l'écran dira simplement que le code n'est pas valide. */
export async function previewInvite(code: string): Promise<{
  ok: boolean; prenomFondateur?: string | null; nbMembres?: number; createdAt?: string; error?: string;
}> {
  const supa = getSupabase();
  if (!supa) return { ok: false, error: 'Connexion indisponible.' };
  const { data, error } = await supa.rpc('preview_invite', { p_code: code });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false };
  return {
    ok: true,
    prenomFondateur: (data.prenom_fondateur as string | null) ?? null,
    nbMembres: data.nb_membres as number,
    createdAt: data.created_at as string,
  };
}

/** Enregistre SON prénom dans le foyer (0014 : policy self + grant colonne).
 * Best-effort : un échec réseau ne doit pas bloquer l'entrée dans l'app — le
 * prénom se re-posera au prochain passage (il n'y a rien d'irréversible ici).
 * Écrit AUSSI la copie locale (T4) : la page de compte et la pastille d'initiale
 * doivent nommer l'occupant hors-ligne, où `membres` est illisible. */
export async function savePrenom(prenom: string): Promise<{ error?: string }> {
  await saveMonPrenom(prenom); // local d'abord : indépendant du réseau
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data: u } = await supa.auth.getUser();
  if (!u.user) return { error: 'Non connecté.' };
  const { error } = await supa.from('membres').update({ prenom: prenom.trim() }).eq('user_id', u.user.id);
  return error ? { error: error.message } : {};
}

/** Extrait le message d'erreur renvoyé par une edge function (sinon message générique). */
async function fnError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx) {
    try {
      const j = await ctx.json();
      if (j?.error) return j.error as string;
    } catch {
      /* corps illisible */
    }
  }
  return (error as Error)?.message ?? 'Erreur.';
}

/** Crée une invitation à rejoindre son foyer (couture premium ②) → renvoie un code partageable. */
export async function createInvite(email?: string): Promise<{ code?: string; expiresAt?: string; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data, error } = await supa.functions.invoke('invite', { body: { email: email ?? null } });
  if (error) return { error: await fnError(error) };
  return { code: data?.code, expiresAt: data?.expires_at };
}

/** Rejoint un foyer via un code d'invitation (quitte le foyer actuel).
 * T2 (Identité & accès) : il n'y a PLUS de fusion. Le foyer d'arrivée fait foi —
 * au cycle suivant, `useSync` voit un changement de foyer et fait purge LOCALE +
 * pull seul. Les données du foyer quitté restent en ligne (rien n'est supprimé).
 * AS-2b : appelle le RPC transactionnel `accept_invite` DIRECTEMENT (remplace l'edge
 * `accept-invite`). Le RPC RETOURNE un statut jsonb {ok, foyer_id, error} — il NE LÈVE
 * PAS sur les erreurs métier (sinon le rollback effacerait le compteur de rate-limit),
 * donc une erreur applicative arrive dans `data.error`, pas dans `error`. */
export async function acceptInvite(code: string): Promise<{ foyerId?: string; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data, error } = await supa.rpc('accept_invite', { p_code: code });
  if (error) return { error: error.message };            // erreur transport / permission
  if (!data?.ok) return { error: data?.error ?? 'Code invalide.' };  // erreur métier (statut)
  // Nouveau contexte de foyer : purge l'état de sync local (méta/curseurs) ; le
  // cycle suivant détectera le changement et re-tirera le foyer rejoint.
  invalidateFoyerCache();
  await clearSyncState();
  return { foyerId: data.foyer_id as string };
}

/**
 * Ce que la page de compte (T4) doit savoir du foyer, en UNE lecture.
 * `membres_select` (0001:135) l'autorise entre co-membres ; `espaces` se compte par
 * `foyer_id` (0002). Hors-ligne, tout échoue proprement → `null`, et la page se
 * rabat sur ce que l'appareil sait de lui-même (`compteLie` + `monPrenom`).
 */
export interface FoyerInfo {
  foyerId: string;
  /** L'utilisateur est-il le TITULAIRE du foyer (ADR 33 : il ne lui survit pas) ? */
  jeSuisFondateur: boolean;
  /** Prénom du titulaire (null s'il ne l'a pas donné) — nomme la maison d'un membre. */
  prenomFondateur: string | null;
  /** Tous les membres, moi inclus, dans l'ordre d'arrivée. */
  membres: { userId: string; prenom: string | null; moi: boolean }[];
  /** Pages partagées vivantes du foyer — ce que la suppression couperait. */
  nbEspaces: number;
}

export async function loadFoyerInfo(): Promise<FoyerInfo | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { data: u } = await supa.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data: moi, error: moiErr } = await supa
    .from('membres')
    .select('foyer_id')
    .eq('user_id', uid)
    .limit(1);
  if (moiErr) return null;
  const foyerId = moi?.[0]?.foyer_id as string | undefined;
  if (!foyerId) return null;

  const { data: rows, error: rowsErr } = await supa
    .from('membres')
    .select('user_id, role, prenom, created_at')
    .eq('foyer_id', foyerId)
    .order('created_at', { ascending: true });
  if (rowsErr) return null;
  const membres = (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    prenom: (r.prenom as string | null) ?? null,
    moi: r.user_id === uid,
  }));
  const fondateur = (rows ?? []).find((r) => r.role === 'owner');

  // Les pages partagées : un échec ici ne doit pas priver la page de tout le reste.
  const { count } = await supa
    .from('espaces')
    .select('token', { count: 'exact', head: true })
    .eq('foyer_id', foyerId);

  return {
    foyerId,
    jeSuisFondateur: fondateur?.user_id === uid,
    prenomFondateur: (fondateur?.prenom as string | null) ?? null,
    membres,
    nbEspaces: count ?? 0,
  };
}

/**
 * Suppression de compte in-app (exigence Apple 5.1.1(v)). L'opération vit côté
 * serveur (edge function `delete-account` en service_role) : selon le rôle, elle
 * fait quitter le foyer (membre) ou supprime le foyer et son contenu (owner),
 * puis efface l'utilisateur auth. Localement : déconnexion + PURGE de l'état de
 * sync (FIX revue Q n°10 — pas d'état fantôme qui re-téléverserait tout en
 * silence après une éventuelle ré-inscription ; la copie locale, elle, reste).
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { error } = await supa.functions.invoke('delete-account', { method: 'POST' });
  if (error) return { error: await fnError(error) };
  invalidateFoyerCache();
  await clearSyncState();
  await clearCompteLie(); // T1 : plus de compte lié → le prochain boot repasse par l'Écran 1
  await supa.auth.signOut();
  return {};
}
