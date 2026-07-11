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

const INVITE_TTL_HOURS = 72; // A3 : un code circule sur WhatsApp → fenêtre courte (single-use en plus)

/** Code lisible (sans caractères ambigus) de 10 signes.
 * AS-2 Fiche 4 : rejection sampling — on rejette les octets >= 248 (le plus grand
 * multiple de 31 sous 256) pour éliminer le BIAIS MODULO de `byte % 31`, et 10
 * signes (vs 8) → ~2^49 de combinaisons, hors de portée d'un brute-force en ligne. */
function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 caractères
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < 10) {
    crypto.getRandomValues(buf);
    if (buf[0] >= 248) continue; // 248 = 31*8 ; au-delà = biais → on retire
    out.push(alphabet[buf[0] % 31]);
  }
  return out.join('');
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

  // AS-2 Fiche 4 : cap 5 invitations ACTIVES (non acceptées, non expirées) / foyer.
  const { count } = await admin
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('foyer_id', foyer)
    .is('accepted_by', null)
    .gt('expires_at', new Date().toISOString());
  if ((count ?? 0) >= 5) {
    return json({ error: 'Trop d’invitations actives (max 5). Attends qu’elles soient utilisées ou expirent.' }, 429);
  }

  const code = makeCode();
  const expires_at = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000).toISOString();
  const { error } = await admin
    .from('invitations')
    .insert({ foyer_id: foyer, email, code, expires_at });
  if (error) return json({ error: error.message }, 500);

  return json({ code, expires_at }, 200);
});
