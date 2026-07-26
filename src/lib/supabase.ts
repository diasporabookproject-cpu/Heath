import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

// Configuration via variables d'environnement (injectées au build).
// L'app reste 100 % fonctionnelle en local si Supabase n'est pas configuré.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const SUPABASE_URL = URL;
export const SUPABASE_KEY = KEY;
export const supabaseEnabled = !!(URL && KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // gère le retour du lien magique
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

export type { Session };
