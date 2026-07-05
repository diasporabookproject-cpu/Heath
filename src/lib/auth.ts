import { getSupabase } from './supabase';

// Auth OTP par e-mail (code 6 chiffres) + foyer paresseux + suppression de compte.
// L'auth n'est JAMAIS bloquante : l'app marche sans compte ; se connecter active
// la sauvegarde/synchro et l'IA. Identité = compte Manzil (jamais un ID de store).

/** Envoie un code de connexion à l'e-mail (crée l'utilisateur si besoin). */
export async function sendOtp(email: string): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { error } = await supa.auth.signInWithOtp({
    email: email.trim(),
    // Redirige le lien magique vers l'app (utile tant que l'e-mail n'a pas de code
    // à 6 chiffres — nécessite un SMTP perso pour éditer le modèle). Le retour du
    // lien ouvre la session via detectSessionInUrl.
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  });
  return error ? { error: error.message } : {};
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

/** Id du foyer de l'utilisateur connecté (null si non connecté / pas de foyer). */
export async function currentFoyerId(): Promise<string | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { data: u } = await supa.auth.getUser();
  if (!u.user) return null;
  const { data } = await supa.from('membres').select('foyer_id').eq('user_id', u.user.id).limit(1);
  return (data?.[0]?.foyer_id as string) ?? null;
}

/** Quitte le foyer courant (retire son appartenance). Au rechargement, un foyer neuf est recréé. */
export async function leaveFoyer(): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data: u } = await supa.auth.getUser();
  if (!u.user) return { error: 'Non connecté.' };
  const { error } = await supa.from('membres').delete().eq('user_id', u.user.id);
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

/** Rejoint un foyer via un code d'invitation (quitte le foyer actuel ; données locales fusionnées au sync). */
export async function acceptInvite(code: string): Promise<{ foyerId?: string; error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { data, error } = await supa.functions.invoke('accept-invite', { body: { code } });
  if (error) return { error: await fnError(error) };
  return { foyerId: data?.foyer_id };
}

/**
 * Suppression de compte in-app (exigence Apple 5.1.1(v)). L'opération vit côté
 * serveur (edge function `delete-account` en service_role) : selon le rôle, elle
 * fait quitter le foyer (membre) ou supprime le foyer et son contenu (owner),
 * puis efface l'utilisateur auth. On déconnecte ensuite localement.
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  const supa = getSupabase();
  if (!supa) return { error: 'Connexion indisponible.' };
  const { error } = await supa.functions.invoke('delete-account', { method: 'POST' });
  if (error) return { error: error.message };
  await supa.auth.signOut();
  return {};
}
