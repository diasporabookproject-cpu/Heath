// Edge function Supabase — traduction d'une liste de textes (page Nounou).
// Relais vers l'API Claude (Anthropic), sortie STRUCTURÉE via "tool use"
// (tableau de traductions, même ordre/longueur que l'entrée). Clé serveur.
// Secret requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.
// Hotfix 2026-07-07 : cette fonction, héritée de l'ère anonyme, n'avait AUCUN
// contrôle → relais Anthropic ouvert. Elle exige désormais une SESSION (JWT) et
// passe par le garde anti-abus (`reserve_abuse_guard`, plafond 1000, clé
// 'abuse-YYYY-MM') — HORS du quota produit (D5). Env auto : SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ABUSE_CAP = 1000; // appels utilitaires / mois / foyer — plafond anti-script (hors quota produit).

interface Denied {
  ok: false;
  status: number;
  error: string;
}

/**
 * Exige une session (JWT) et incrémente le garde anti-abus namespacé du foyer.
 * Renvoie 401/403 sans session, 429 au plafond. Aucun appel LLM ne se fait sans
 * passer par là. Pas de refund (un script qui échoue en boucle plafonne plus vite).
 */
async function reserveAbuse(req: Request): Promise<{ ok: true } | Denied> {
  const url = Deno.env.get('SUPABASE_URL');
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !svc) return { ok: false, status: 500, error: 'Config serveur manquante.' };
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false, status: 401, error: 'Connecte-toi pour utiliser la traduction.' };
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u.user) return { ok: false, status: 401, error: 'Session invalide.' };
  const { data: mem } = await admin.from('membres').select('foyer_id').eq('user_id', u.user.id).limit(1);
  const foyer = mem?.[0]?.foyer_id as string | undefined;
  if (!foyer) return { ok: false, status: 403, error: 'Foyer introuvable.' };
  const month = 'abuse-' + new Date().toISOString().slice(0, 7);
  const { data: used, error } = await admin.rpc('reserve_abuse_guard', { f: foyer, m: month, cap: ABUSE_CAP });
  if (error) return { ok: false, status: 500, error: 'Service indisponible : ' + error.message };
  if (used === null || used === undefined) return { ok: false, status: 429, error: 'Trop de requêtes ce mois-ci.' };
  return { ok: true };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGETS: Record<string, string> = {
  darija: 'la DARIJA MAROCAINE EN LETTRES ARABES',
  arabe: "l'ARABE STANDARD MODERNE",
  anglais: "l'ANGLAIS",
};

function system(targetLabel: string): string {
  return `Tu traduis du français vers ${targetLabel}, pour une page destinée au personnel d'un foyer (nounou).
Règles ABSOLUES :
- Traduis FIDÈLEMENT, ton clair et simple, registre courant.
- Garde les chiffres, heures et unités tels quels (08:00, 38,5°C, O+…).
- NE traduis PAS les noms propres de personnes ni de lieux (Khadija, Yasmine, École Al Madina…).
- Conserve les retours à la ligne à l'intérieur d'un texte (étapes).
- Rends EXACTEMENT le même nombre de traductions, dans le MÊME ORDRE que l'entrée.
Utilise l'outil fourni pour répondre.`;
}

const TOOL = {
  name: 'traductions',
  description: 'Enregistre les traductions, dans le même ordre que les textes fournis.',
  input_schema: {
    type: 'object',
    properties: {
      translations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Une traduction par texte d\'entrée, même ordre.',
      },
    },
    required: ['translations'],
  },
};

async function callTool(
  key: string,
  sys: string,
  user: string,
  // deno-lint-ignore no-explicit-any
): Promise<{ translations?: string[]; error?: string }> {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: sys,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return { error: 'LLM: ' + (await res.text()).slice(0, 300) };
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const block = (data?.content ?? []).find((c: any) => c.type === 'tool_use');
  const out = block?.input?.translations;
  if (!Array.isArray(out)) return { error: 'Pas de sortie structurée.' };
  return { translations: out.map((s: unknown) => String(s ?? '')) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquant côté serveur.' }, 500);

    const body = await req.json().catch(() => ({}));
    const texts: string[] = Array.isArray(body?.texts) ? body.texts.map((t: unknown) => String(t ?? '')) : [];
    const targetLabel = TARGETS[String(body?.target ?? '')];
    if (!texts.length) return json({ error: 'Aucun texte à traduire.' }, 400);
    if (!targetLabel) return json({ error: 'Langue cible inconnue.' }, 400);

    const guard = await reserveAbuse(req); // session exigée + garde anti-abus (hors quota produit)
    if (!guard.ok) return json({ error: guard.error }, guard.status);

    // Numérotation pour fiabiliser l'alignement entrée/sortie.
    const user =
      'Traduis ces textes (un par ligne, numérotés). Rends le tableau dans le même ordre :\n\n' +
      texts.map((t, i) => `[${i + 1}] ${t.replace(/\n/g, ' ⏎ ')}`).join('\n');

    const out = await callTool(key, system(targetLabel), user);
    if (out.error) return json({ error: out.error }, 502);

    // Restaure les retours à la ligne et aligne la longueur.
    const translations = (out.translations ?? [])
      .slice(0, texts.length)
      .map((t) => t.replace(/ ?⏎ ?/g, '\n'));
    while (translations.length < texts.length) translations.push('');
    return json({ translations }, 200);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
