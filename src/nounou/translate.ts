import { getSupabase } from '../lib/supabase';
import type { NounouLangue } from '../types';

// Client de l'edge function `generate-translation`. La langue d'auteur (fr) ne
// se traduit pas. Renvoie un tableau aligné sur l'entrée, ou null si indisponible.

const TARGET: Partial<Record<NounouLangue, string>> = {
  dr: 'darija',
  ar: 'arabe',
  en: 'anglais',
};

export function isAuthorLang(langue: NounouLangue): boolean {
  return langue === 'fr';
}

/** Traduit une liste de textes vers la langue cible (par lots). */
export async function translateTexts(
  langue: NounouLangue,
  texts: string[],
): Promise<string[] | null> {
  const target = TARGET[langue];
  if (!target || texts.length === 0) return null;
  const supa = getSupabase();
  if (!supa) return null;
  const { data: sess } = await supa.auth.getSession();
  if (!sess.session) throw new Error('Connectez-vous pour générer les traductions.');

  const out: string[] = [];
  const BATCH = 40; // limite la taille d'un appel (latence/tokens)
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const { data, error } = await supa.functions.invoke('generate-translation', {
      body: { texts: chunk, target },
    });
    if (error || !data || data.error || !Array.isArray(data.translations)) {
      let detail = error?.message ?? data?.error ?? 'indisponible';
      try {
        const ctx = (error as { context?: Response } | undefined)?.context;
        if (ctx) {
          const raw = await ctx.text();
          detail = JSON.parse(raw)?.error || raw || detail;
        }
      } catch {
        /* corps illisible */
      }
      throw new Error('Traduction : ' + detail);
    }
    const arr = data.translations as string[];
    for (let j = 0; j < chunk.length; j++) out.push(String(arr[j] ?? ''));
  }
  return out;
}
