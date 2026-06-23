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
- Fournir une version darija marocaine EN LETTRES ARABES (nom_ar, ingredients_ar),
  même ordre/quantités, chiffres et "g" inchangés.

Réponds UNIQUEMENT par un objet JSON valide (sans texte autour, sans balises code) avec EXACTEMENT ces clés :
{"nom":"","type":"Déjeuner|Dîner|Coupe-faim","jour":"Tous|Repos|Sport","kcal":0,"prot":0,"gluc":0,"lip":0,"calcium":0,"flag_calcium":"Champion|Moyen|Faible","ingredients":"","nom_ar":"","ingredients_ar":""}
Les macros sont des ESTIMATIONS (l'humain vérifiera).`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY manquant côté serveur.' }, 500);

    const { intention } = await req.json().catch(() => ({ intention: '' }));
    if (!intention || typeof intention !== 'string') return json({ error: 'Intention manquante.' }, 400);

    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Recette voulue : ${intention}` }],
      }),
    });
    if (!res.ok) return json({ error: 'LLM: ' + (await res.text()).slice(0, 300) }, 502);

    const data = await res.json();
    const text: string = (data?.content?.[0]?.text ?? '').trim();
    const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    let recipe: unknown;
    try {
      recipe = JSON.parse(jsonStr);
    } catch {
      return json({ error: 'Réponse IA illisible.', raw: text.slice(0, 500) }, 502);
    }
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
