// Edge function Supabase — créer une invitation à rejoindre son foyer (S4).
// Opération SERVEUR (service_role) : couture premium ② (gratuite/ouverte en v1,
// mais comptabilisée et gatable plus tard). Le membre connecté génère un CODE
// partageable ; un autre compte Manzil l'utilise via `accept-invite`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s: number) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

const INVITE_TTL_DAYS = 7;

/** Code lisible (sans caractères ambigus) de 8 signes. */
function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !svc) return json({ error: 'Config serveur manquante.' }, 500);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Non authentifié.' }, 401);

  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u.user) return json({ error: 'Session invalide.' }, 401);

  const { data: mem } = await admin.from('membres').select('foyer_id').eq('user_id', u.user.id).limit(1);
  const foyer = mem?.[0]?.foyer_id as string | undefined;
  if (!foyer) return json({ error: 'Aucun foyer à partager.' }, 403);

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : null;

  const code = makeCode();
  const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();
  const { error } = await admin
    .from('invitations')
    .insert({ foyer_id: foyer, email, code, expires_at });
  if (error) return json({ error: error.message }, 500);

  return json({ code, expires_at }, 200);
});
