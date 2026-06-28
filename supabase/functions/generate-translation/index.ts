// Edge function Supabase — traduction d'une liste de textes (page Nounou).
// Relais vers l'API Claude (Anthropic), sortie STRUCTURÉE via "tool use"
// (tableau de traductions, même ordre/longueur que l'entrée). Clé serveur.
// Secret requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.

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
