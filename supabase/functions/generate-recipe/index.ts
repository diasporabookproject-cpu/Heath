// Edge function Supabase — relais vers l'API Claude (Anthropic).
// Modes : génération de recette (défaut), estimation de macros, traduction darija,
// import texte, import PHOTO (T4b, mode 'import-image' : page de livre / capture).
// Sortie STRUCTURÉE garantie via "tool use" (le modèle remplit un schéma → toujours
// un objet valide, jamais de "réponse illisible"). Clé serveur uniquement.
// Secret requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.
// S5 : les modes qui GÉNÈRENT (imports + génération) exigent une session et sont
// plafonnés côté SERVEUR (table `ai_usage`, plafond généreux — couture premium ①).
// Hotfix 2026-07-07 : estimate/translate exigent AUSSI une session + un garde
// anti-abus dédié (`reserve_abuse_guard`, plafond 1000, clé 'abuse-YYYY-MM') — ils
// restent HORS du quota produit (D5 : darija = différenciateur), mais ne sont plus
// un relais Anthropic ouvert.
// T4b (lot Cuisine, F4.4) : les imports acceptent `regles` (règles du foyer, T3)
// et `adaptation` (demande libre) — les règles du foyer PRIMENT sur la demande.
// Le serveur ne LIT jamais les règles en base : elles voyagent dans la requête.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AI_CAP = 100; // générations / mois / foyer (Q4). Constante serveur, ajustable.
// Garde anti-abus pour les relais utilitaires (estimate/translate) : plafond TRÈS
// haut, hors d'atteinte d'un usage humain — ne sert qu'à stopper un script. HORS du
// quota produit (D5) via une clé de mois namespacée 'abuse-YYYY-MM' dans `ai_usage`.
const ABUSE_CAP = 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `Tu génères un BROUILLON de recette pour un foyer suivant un protocole nutritionnel strict.
Contraintes ABSOLUES :
- 100% SANS GLUTEN. Calcium valorisé (enjeu n°1) ; protéines élevées ; glucides maîtrisés.
- Mesures à la cuillère "1 càc"/"1 càs" conservées (ne PAS convertir en grammes).
- Ingrédients = texte d'1 portion, composants séparés par " · ", items distincts par " + ".
- etapes = une étape par ligne (séparées par des retours à la ligne), courtes et claires.
- Darija marocaine EN LETTRES ARABES (nom_ar, ingredients_ar, etapes_ar), même ordre/quantités.
Les macros sont des ESTIMATIONS. Utilise l'outil fourni pour répondre.`;

const SYSTEM_ESTIMATE = `Tu es un assistant nutrition. Estime les macros d'UNE portion à partir des ingrédients.
Calcium = enjeu n°1 (laitages, amandes, sésame/tahini, sardines...). flag_calcium : Champion>=300, Moyen>=150, sinon Faible.
Valeurs = ESTIMATIONS. Utilise l'outil fourni pour répondre.`;

const SYSTEM_TRANSLATE = `Tu traduis du contenu culinaire du français vers la DARIJA MAROCAINE EN LETTRES ARABES.
Garde chiffres et unités tels quels (200g, 1 càc…). etapes_ar = une étape par ligne, même découpage.
Utilise l'outil fourni pour répondre.`;

const SYSTEM_IMPORT = `Tu STRUCTURES une recette à partir d'un texte collé (légende Instagram, blog…).
Reste fidèle au texte ; complète les manques de façon raisonnable. Détecte le RÔLE
(petit-déj/entrée/plat/accompagnement). ingredients = composants séparés par " · " avec leurs quantités ;
etapes = une étape par ligne. Estime les macros (ESTIMATIONS). Conserve les càc/càs.
Fournis aussi la darija (nom_ar, ingredients_ar, etapes_ar). Utilise l'outil fourni pour répondre.`;

const RECIPE_TOOL = {
  name: 'recette',
  description: 'Enregistre la recette structurée.',
  input_schema: {
    type: 'object',
    properties: {
      nom: { type: 'string' },
      role: { type: 'string', enum: ['petitdej', 'entree', 'plat', 'acc'], description: 'petit-déj / entrée / plat / accompagnement' },
      kcal: { type: 'number' },
      prot: { type: 'number' },
      gluc: { type: 'number' },
      lip: { type: 'number' },
      calcium: { type: 'number' },
      flag_calcium: { type: 'string', enum: ['Champion', 'Moyen', 'Faible'] },
      ingredients: { type: 'string' },
      etapes: { type: 'string' },
      nom_ar: { type: 'string' },
      ingredients_ar: { type: 'string' },
      etapes_ar: { type: 'string' },
    },
    required: ['nom', 'role', 'kcal', 'prot', 'gluc', 'lip', 'calcium', 'flag_calcium', 'ingredients', 'etapes', 'nom_ar', 'ingredients_ar', 'etapes_ar'],
  },
};

const MACROS_TOOL = {
  name: 'macros',
  description: 'Enregistre les macros estimées.',
  input_schema: {
    type: 'object',
    properties: {
      kcal: { type: 'number' },
      prot: { type: 'number' },
      gluc: { type: 'number' },
      lip: { type: 'number' },
      calcium: { type: 'number' },
      flag_calcium: { type: 'string', enum: ['Champion', 'Moyen', 'Faible'] },
    },
    required: ['kcal', 'prot', 'gluc', 'lip', 'calcium', 'flag_calcium'],
  },
};

const TRANSLATE_TOOL = {
  name: 'traduction',
  description: 'Enregistre la traduction en darija (lettres arabes).',
  input_schema: {
    type: 'object',
    properties: {
      nom_ar: { type: 'string' },
      ingredients_ar: { type: 'string' },
      etapes_ar: { type: 'string' },
    },
    required: ['nom_ar', 'ingredients_ar', 'etapes_ar'],
  },
};

/** Bloc « règles du foyer + adaptation » ajouté au message utilisateur (F4.4).
 * G3 côté serveur : les règles arrivent EXPLICITES dans la requête (jamais lues
 * en base), et le conflit est tranché dans le prompt : le foyer PRIME. */
function reglesBlock(regles?: unknown, adaptation?: unknown): string {
  const r = Array.isArray(regles) ? regles.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
  const a = String(adaptation ?? '').trim().slice(0, 300);
  let s = '';
  if (r.length) s += `\nRÈGLES DU FOYER (à appliquer d'office, PRIORITAIRES) : ${r.join(' · ')}.`;
  if (a) s += `\nDemande d'adaptation : ${a}.`;
  if (r.length && a) s += `\nEn cas de conflit, les règles du foyer priment sur la demande.`;
  return s;
}

// deno-lint-ignore no-explicit-any
async function callTool(key: string, system: string, user: string | unknown[], maxTokens: number, tool: any): Promise<{ input?: Record<string, unknown>; error?: string }> {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return { error: 'LLM: ' + (await res.text()).slice(0, 300) };
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const block = (data?.content ?? []).find((c: any) => c.type === 'tool_use');
  if (!block?.input) return { error: 'Pas de sortie structurée.' };
  return { input: block.input as Record<string, unknown> };
}

// deno-lint-ignore no-explicit-any
type Admin = any;

interface Reserved {
  ok: true;
  admin: Admin;
  foyer: string;
  month: string;
  used: number;
  cap: number;
}
interface Denied {
  ok: false;
  status: number;
  error: string;
}

interface FoyerCtx {
  ok: true;
  admin: Admin;
  foyer: string;
}

/**
 * Résout le foyer de l'appelant via son JWT (exige une session). Base commune du
 * quota produit ET du garde anti-abus : AUCUN appel LLM sans passer par là.
 */
async function resolveFoyer(req: Request): Promise<FoyerCtx | Denied> {
  const url = Deno.env.get('SUPABASE_URL');
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !svc) return { ok: false, status: 500, error: 'Config serveur manquante.' };
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false, status: 401, error: 'Connecte-toi pour utiliser l’IA.' };
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u.user) return { ok: false, status: 401, error: 'Session invalide.' };
  const { data: mem } = await admin.from('membres').select('foyer_id').eq('user_id', u.user.id).limit(1);
  const foyer = mem?.[0]?.foyer_id as string | undefined;
  if (!foyer) return { ok: false, status: 403, error: 'Foyer introuvable.' };
  return { ok: true, admin, foyer };
}

/**
 * Identifie le foyer via le JWT et RÉSERVE une génération — ATOMIQUE via le RPC
 * `reserve_ai_usage` (migration 0004) : plus de course read-modify-write
 * (FIX revue Q n°9). Renvoie 429 si le plafond est atteint.
 */
async function reserveQuota(req: Request): Promise<Reserved | Denied> {
  const ctx = await resolveFoyer(req);
  if (!ctx.ok) return ctx;
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC, aligné client)
  const { data: used, error: rErr } = await ctx.admin.rpc('reserve_ai_usage', { f: ctx.foyer, m: month, cap: AI_CAP });
  if (rErr) return { ok: false, status: 500, error: 'Quota indisponible : ' + rErr.message };
  if (used === null || used === undefined) {
    return { ok: false, status: 429, error: `Quota IA du mois atteint (${AI_CAP}/mois).` };
  }
  return { ok: true, admin: ctx.admin, foyer: ctx.foyer, month, used: used as number, cap: AI_CAP };
}

/**
 * Garde anti-abus des relais utilitaires (estimate/translate) : exige une session
 * et incrémente un compteur NAMESPACÉ ('abuse-YYYY-MM') plafonné à ABUSE_CAP, hors
 * du quota produit (D5). Pas de refund : un script qui échoue en boucle atteint le
 * plafond plus vite — c'est l'effet voulu. Renvoie 429 au plafond, 401/403 sans session.
 */
async function reserveAbuse(req: Request): Promise<{ ok: true } | Denied> {
  const ctx = await resolveFoyer(req);
  if (!ctx.ok) return ctx;
  const month = 'abuse-' + new Date().toISOString().slice(0, 7);
  const { data: used, error } = await ctx.admin.rpc('reserve_abuse_guard', { f: ctx.foyer, m: month, cap: ABUSE_CAP });
  if (error) return { ok: false, status: 500, error: 'Service indisponible : ' + error.message };
  if (used === null || used === undefined) return { ok: false, status: 429, error: 'Trop de requêtes ce mois-ci.' };
  return { ok: true };
}

/** Rembourse une réservation si la génération a échoué (on ne fait pas payer un échec). */
async function refund(r: Reserved): Promise<void> {
  await r.admin.rpc('refund_ai_usage', { f: r.foyer, m: r.month });
}

/**
 * Exécute l'appel LLM sous réservation : rembourse sur `{error}` ET sur throw
 * (réseau/timeout — FIX revue Q n°9 : avant, un fetch qui jetait sautait le refund).
 */
async function callToolReserved(
  q: Reserved,
  key: string,
  system: string,
  user: string | unknown[],
  maxTokens: number,
  // deno-lint-ignore no-explicit-any
  tool: any,
): Promise<{ input?: Record<string, unknown>; error?: string }> {
  try {
    const out = await callTool(key, system, user, maxTokens, tool);
    if (out.error) await refund(q);
    return out;
  } catch (e) {
    await refund(q);
    return { error: String((e as Error).message ?? e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquant côté serveur.' }, 500);

    const body = await req.json().catch(() => ({}));

    if (body?.mode === 'estimate') {
      const ingredients = String(body.ingredients ?? '').trim();
      if (!ingredients) return json({ error: 'Ingrédients manquants.' }, 400);
      const guard = await reserveAbuse(req); // session exigée + garde anti-abus (hors quota produit)
      if (!guard.ok) return json({ error: guard.error }, guard.status);
      const user = `Type : ${body.type ?? 'plat'}\nIngrédients (1 portion) : ${ingredients}`;
      const out = await callTool(key, SYSTEM_ESTIMATE, user, 512, MACROS_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ macros: out.input }, 200);
    }

    if (body?.mode === 'import') {
      const text = String(body.text ?? '').trim();
      if (!text) return json({ error: 'Texte manquant.' }, 400);
      const q = await reserveQuota(req);
      if (!q.ok) return json({ error: q.error }, q.status);
      const user = `Texte de la recette :\n${text}` + reglesBlock(body.regles, body.adaptation);
      const out = await callToolReserved(q, key, SYSTEM_IMPORT, user, 2048, RECIPE_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ recipe: out.input, quota: { used: q.used, cap: q.cap } }, 200);
    }

    // T4b — import PHOTO (page de livre, capture d'écran, note manuscrite).
    // Image = JPEG ≤1280px ré-encodé côté client (EXIF/GPS supprimés au passage).
    // Gardes en profondeur : taille du base64 (~6 Mo), media_type fermé.
    if (body?.mode === 'import-image') {
      const img = String(body.image ?? '');
      const mediaType = String(body.media_type ?? 'image/jpeg');
      if (!img) return json({ error: 'Photo manquante.' }, 400);
      if (img.length > 8_000_000) return json({ error: 'Photo trop lourde — réessaie avec une photo plus légère.' }, 400);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
        return json({ error: 'Format d’image non pris en charge.' }, 400);
      }
      const q = await reserveQuota(req);
      if (!q.ok) return json({ error: q.error }, q.status);
      const content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: img } },
        {
          type: 'text',
          text:
            'Structure la recette LISIBLE sur cette photo (page de livre, capture, note manuscrite). ' +
            'Si aucune recette n’est lisible, laisse nom et ingredients VIDES.' +
            reglesBlock(body.regles, body.adaptation),
        },
      ];
      const out = await callToolReserved(q, key, SYSTEM_IMPORT, content, 2048, RECIPE_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      // Photo illisible = schéma valide mais vide → on REMBOURSE (on ne fait pas
      // payer une photo floue) et on répond honnête (le client propose « L'écrire »).
      const rec = out.input as Record<string, unknown>;
      if (!String(rec?.nom ?? '').trim() || !String(rec?.ingredients ?? '').trim()) {
        await refund(q);
        return json({ error: 'On n’a pas réussi à lire une recette sur cette photo.' }, 422);
      }
      return json({ recipe: out.input, quota: { used: q.used, cap: q.cap } }, 200);
    }

    if (body?.mode === 'translate') {
      const guard = await reserveAbuse(req); // session exigée + garde anti-abus (hors quota produit)
      if (!guard.ok) return json({ error: guard.error }, guard.status);
      const { nom, ingredients, etapes } = body;
      const user = `nom : ${nom ?? ''}\ningrédients : ${ingredients ?? ''}\netapes : ${etapes ?? ''}`;
      const out = await callTool(key, SYSTEM_TRANSLATE, user, 1536, TRANSLATE_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ translation: out.input }, 200);
    }

    const intention = body?.intention;
    if (!intention || typeof intention !== 'string') return json({ error: 'Intention manquante.' }, 400);
    const q = await reserveQuota(req);
    if (!q.ok) return json({ error: q.error }, q.status);
    // F4.4 : même champ « À partir d'instructions » → mêmes règles du foyer.
    const out = await callToolReserved(q, key, SYSTEM, `Recette voulue : ${intention}` + reglesBlock(body.regles, body.adaptation), 2048, RECIPE_TOOL);
    if (out.error) return json({ error: out.error }, 502);
    return json({ recipe: out.input, quota: { used: q.used, cap: q.cap } }, 200);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
