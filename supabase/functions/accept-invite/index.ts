// Edge function Supabase — accepter une invitation et rejoindre le foyer (S4).
// Opération SERVEUR (service_role). L'utilisateur connecté fournit un CODE ; on
// le rattache au foyer de l'invitation (rôle 'membre'). Respecte l'invariant
// « un foyer par utilisateur » : on retire d'abord l'appartenance actuelle.
// (Sa donnée LOCALE sera fusionnée dans le foyer rejoint au prochain sync — adoption.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s: number) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

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
  const uid = u.user.id;

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code) return json({ error: 'Code manquant.' }, 400);

  const { data: inv } = await admin
    .from('invitations')
    .select('id, foyer_id, expires_at, accepted_by')
    .eq('code', code)
    .maybeSingle();
  if (!inv) return json({ error: 'Code inconnu.' }, 404);
  if (inv.accepted_by) return json({ error: 'Invitation déjà utilisée.' }, 409);
  if (new Date(inv.expires_at).getTime() < Date.now()) return json({ error: 'Invitation expirée.' }, 410);

  // Déjà dans ce foyer ? Rien à faire (idempotent).
  const { data: already } = await admin
    .from('membres')
    .select('foyer_id')
    .eq('user_id', uid)
    .eq('foyer_id', inv.foyer_id)
    .maybeSingle();
  if (!already) {
    // Quitte le foyer actuel (invariant un-foyer-par-utilisateur), puis rejoint.
    // FIX revue Q n°1 : un OWNER ne laisse jamais un foyer orphelin (docs
    // inaccessibles + FK owner_user_id RESTRICT qui bloquerait à jamais la
    // suppression du compte). Seul membre ⇒ son ancien foyer est supprimé
    // (cascade) ; d'autres membres ⇒ refus explicite.
    const { data: cur } = await admin
      .from('membres')
      .select('foyer_id, role')
      .eq('user_id', uid);
    for (const m of cur ?? []) {
      if (m.role === 'owner') {
        const { count } = await admin
          .from('membres')
          .select('user_id', { count: 'exact', head: true })
          .eq('foyer_id', m.foyer_id);
        if ((count ?? 1) > 1) {
          return json(
            { error: 'Ton foyer a d’autres membres — retire-les avant de rejoindre un autre foyer.' },
            409,
          );
        }
        const { error: delErr } = await admin.from('foyers').delete().eq('id', m.foyer_id);
        if (delErr) return json({ error: delErr.message }, 500);
      }
    }
    await admin.from('membres').delete().eq('user_id', uid);
    const { error: insErr } = await admin
      .from('membres')
      .insert({ foyer_id: inv.foyer_id, user_id: uid, role: 'membre' });
    if (insErr) return json({ error: insErr.message }, 500);
  }
  await admin.from('invitations').update({ accepted_by: uid }).eq('id', inv.id);

  return json({ ok: true, foyer_id: inv.foyer_id }, 200);
});
