// Edge function Supabase — suppression de compte in-app (exigence Apple 5.1.1(v)).
// Opération SERVEUR en service_role : selon le rôle, elle supprime le foyer (owner,
// cascade sur membres/docs/ai_usage/invitations — et espaces dès 0002) ou fait
// quitter le foyer (membre), puis efface l'utilisateur auth.
// Aucune donnée de contenu n'est lue/loggée. Env auto : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Config serveur manquante.' }, 500);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Non authentifié.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !userData.user) return json({ error: 'Session invalide.' }, 401);
  const uid = userData.user.id;

  // Foyer(s) de l'utilisateur (un seul en v1).
  const { data: mem, error: mErr } = await admin
    .from('membres')
    .select('foyer_id, role')
    .eq('user_id', uid);
  if (mErr) return json({ error: mErr.message }, 500);

  for (const m of mem ?? []) {
    if (m.role === 'owner') {
      // Cascade : membres, docs, ai_usage, invitations (et espaces dès 0002) partent avec le foyer.
      const { error } = await admin.from('foyers').delete().eq('id', m.foyer_id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await admin
        .from('membres')
        .delete()
        .eq('foyer_id', m.foyer_id)
        .eq('user_id', uid);
      if (error) return json({ error: error.message }, 500);
    }
  }

  // FIX revue Q n°1 : balaye aussi les foyers dont l'utilisateur est resté
  // propriétaire SANS ligne membre (orphelins d'anciens flux) — sinon la FK
  // owner_user_id RESTRICT bloque définitivement deleteUser ci-dessous.
  const { error: orphErr } = await admin.from('foyers').delete().eq('owner_user_id', uid);
  if (orphErr) return json({ error: orphErr.message }, 500);

  // Efface l'utilisateur auth lui-même.
  const { error: dErr } = await admin.auth.admin.deleteUser(uid);
  if (dErr) return json({ error: dErr.message }, 500);

  return json({ ok: true }, 200);
});
