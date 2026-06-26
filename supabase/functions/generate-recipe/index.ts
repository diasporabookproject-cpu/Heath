// Edge function Supabase — relais vers l'API Claude (Anthropic) pour générer un
// BROUILLON de recette. La clé API reste côté serveur (jamais dans le front).
// Déploiement : `supabase functions deploy generate-recipe` (ou via le dashboard).
// Secret requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.
//
// L'appel exige un utilisateur authentifié (verify_jwt par défaut). La sortie
// est un brouillon : l'humain relit/valide côté app (rien n'est « Validé » auto).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `Tu génères un BROUILLON de recette pour un foyer suivant un protocole nutritionnel strict.
Contraintes ABSOLUES :
- 100% SANS GLUTEN (aucun ingrédient contenant du gluten).
- Calcium valorisé (c'est l'enjeu n°1) ; protéines élevées ; glucides maîtrisés.
- Garder les mesures à la cuillère "1 càc"/"1 càs" (ne PAS convertir en grammes).
- Ingrédients = texte d'1 portion, composants séparés par " · ", items distincts par " + ".
- "etapes" = préparation, UNE étape par ligne (séparées par \\n), courtes et claires.
- Fournir une version darija marocaine EN LETTRES ARABES (nom_ar, ingredients_ar, etapes_ar),
  même ordre/quantités, chiffres et "g" inchangés.

Réponds UNIQUEMENT par un objet JSON valide (sans texte autour, sans balises code) avec EXACTEMENT ces clés :
{"nom":"","type":"Déjeuner|Dîner|Coupe-faim","jour":"Tous|Repos|Sport","kcal":0,"prot":0,"gluc":0,"lip":0,"calcium":0,"flag_calcium":"Champion|Moyen|Faible","ingredients":"","etapes":"","nom_ar":"","ingredients_ar":"","etapes_ar":""}
Les macros sont des ESTIMATIONS (l'humain vérifiera).`;

// Mode "estimate" : calcul des macros d'UNE portion à partir d'ingrédients donnés.
const SYSTEM_ESTIMATE = `Tu es un assistant nutrition. À partir d'une liste d'ingrédients pour UNE portion,
estime les macros. Calcium = enjeu n°1, sois soigneux (laitages, amandes, sésame/tahini, sardines...).
Réponds UNIQUEMENT par un JSON valide (sans texte autour, sans balises) avec EXACTEMENT ces clés :
{"kcal":0,"prot":0,"gluc":0,"lip":0,"calcium":0,"flag_calcium":"Champion|Moyen|Faible"}
flag_calcium : Champion si calcium>=300, Moyen si >=150, sinon Faible. Valeurs = ESTIMATIONS.`;

// Mode "translate" : traduit nom/ingrédients/étapes vers la darija (lettres arabes).
const SYSTEM_TRANSLATE = `Tu traduis du contenu culinaire du français vers la DARIJA MAROCAINE EN LETTRES ARABES.
Garde les chiffres et unités tels quels (200g, 1 càc…). Ne convertis pas les mesures.
"etapes" = une étape par ligne (séparées par \\n), même découpage qu'en entrée.
Réponds UNIQUEMENT par un JSON valide (sans texte autour, sans balises) avec EXACTEMENT ces clés :
{"nom_ar":"","ingredients_ar":"","etapes_ar":""}`;

async function callLLM(key: string, system: string, user: string, maxTokens: number): Promise<{ text?: string; error?: string }> {
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) return { error: 'LLM: ' + (await res.text()).slice(0, 300) };
  const data = await res.json();
  return { text: (data?.content?.[0]?.text ?? '').trim() };
}

function parseJsonBlock(text: string): unknown | null {
  const s = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const tryParse = (x: string): unknown | null => {
    try {
      return JSON.parse(x);
    } catch {
      return null;
    }
  };
  // 1) tel quel ; 2) sinon, extraire le 1er objet { … } (texte autour, fences…)
  const direct = tryParse(s);
  if (direct) return direct;
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b > a) return tryParse(s.slice(a, b + 1));
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquant côté serveur.' }, 500);

    const body = await req.json().catch(() => ({}));

    // --- Mode estimation de macros ---
    if (body?.mode === 'estimate') {
      const ingredients = String(body.ingredients ?? '').trim();
      if (!ingredients) return json({ error: 'Ingrédients manquants.' }, 400);
      const user = `Type : ${body.type ?? 'plat'}\nIngrédients (1 portion) : ${ingredients}`;
      const out = await callLLM(key, SYSTEM_ESTIMATE, user, 256);
      if (out.error) return json({ error: out.error }, 502);
      const macros = parseJsonBlock(out.text ?? '');
      if (!macros) return json({ error: 'Réponse IA illisible.', raw: (out.text ?? '').slice(0, 500) }, 502);
      return json({ macros }, 200);
    }

    // --- Mode traduction (darija) ---
    if (body?.mode === 'translate') {
      const { nom, ingredients, etapes } = body;
      const user = `nom : ${nom ?? ''}\ningrédients : ${ingredients ?? ''}\netapes : ${etapes ?? ''}`;
      const out = await callLLM(key, SYSTEM_TRANSLATE, user, 1536);
      if (out.error) return json({ error: out.error }, 502);
      const tr = parseJsonBlock(out.text ?? '');
      if (!tr) return json({ error: 'Réponse IA illisible.', raw: (out.text ?? '').slice(0, 500) }, 502);
      return json({ translation: tr }, 200);
    }

    // --- Mode génération de brouillon (défaut, rétro-compatible) ---
    const intention = body?.intention;
    if (!intention || typeof intention !== 'string') return json({ error: 'Intention manquante.' }, 400);
    const out = await callLLM(key, SYSTEM, `Recette voulue : ${intention}`, 2048);
    if (out.error) return json({ error: out.error }, 502);
    const recipe = parseJsonBlock(out.text ?? '');
    if (!recipe) return json({ error: 'Réponse IA illisible.', raw: (out.text ?? '').slice(0, 500) }, 502);
    return json({ recipe }, 200);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
