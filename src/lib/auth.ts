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
