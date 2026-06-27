// Edge function Supabase — relais vers l'API Claude (Anthropic).
// Modes : génération de recette (défaut), estimation de macros, traduction darija.
// Sortie STRUCTURÉE garantie via "tool use" (le modèle remplit un schéma → toujours
// un objet valide, jamais de "réponse illisible"). Clé serveur uniquement.
// Secret requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.

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

// deno-lint-ignore no-explicit-any
async function callTool(key: string, system: string, user: string, maxTokens: number, tool: any): Promise<{ input?: Record<string, unknown>; error?: string }> {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquant côté serveur.' }, 500);

    const body = await req.json().catch(() => ({}));

    if (body?.mode === 'estimate') {
      const ingredients = String(body.ingredients ?? '').trim();
      if (!ingredients) return json({ error: 'Ingrédients manquants.' }, 400);
      const user = `Type : ${body.type ?? 'plat'}\nIngrédients (1 portion) : ${ingredients}`;
      const out = await callTool(key, SYSTEM_ESTIMATE, user, 512, MACROS_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ macros: out.input }, 200);
    }

    if (body?.mode === 'import') {
      const text = String(body.text ?? '').trim();
      if (!text) return json({ error: 'Texte manquant.' }, 400);
      const out = await callTool(key, SYSTEM_IMPORT, `Texte de la recette :\n${text}`, 2048, RECIPE_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ recipe: out.input }, 200);
    }

    if (body?.mode === 'translate') {
      const { nom, ingredients, etapes } = body;
      const user = `nom : ${nom ?? ''}\ningrédients : ${ingredients ?? ''}\netapes : ${etapes ?? ''}`;
      const out = await callTool(key, SYSTEM_TRANSLATE, user, 1536, TRANSLATE_TOOL);
      if (out.error) return json({ error: out.error }, 502);
      return json({ translation: out.input }, 200);
    }

    const intention = body?.intention;
    if (!intention || typeof intention !== 'string') return json({ error: 'Intention manquante.' }, 400);
    const out = await callTool(key, SYSTEM, `Recette voulue : ${intention}`, 2048, RECIPE_TOOL);
    if (out.error) return json({ error: out.error }, 502);
    return json({ recipe: out.input }, 200);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
