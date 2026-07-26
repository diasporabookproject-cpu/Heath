import { getSupabase } from './supabase';

// Appel de l'edge function de génération de recette (relais Claude).
// Renvoie un objet brouillon (champs recette) ; l'humain valide ensuite.
// (Lot simplification : plus de macros/estimation — un menu, pas un tableur.)

export interface RecipeDraft {
  nom?: string;
  role?: string;
  type?: string;
  jour?: string;
  ingredients?: string;
  etapes?: string;
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
  // Prompt v2 (lot simplification T2) — optionnels : ABSENTS avec l'ancien edge
  // (tolérance bidirectionnelle : le client neuf tolère leur absence).
  adaptations?: { regle?: string; action?: string }[];
  quantites_incertaines?: string[];
  alerte_regles?: string[];
}

/** F4.4 : règles du foyer (T3) + demande d'adaptation, jointes aux imports.
 * Le serveur ne lit jamais les règles en base — elles voyagent dans la requête. */
export interface AdaptOpts {
  regles?: string[];
  adaptation?: string;
}

export async function generateRecipeDraft(intention: string, opts: AdaptOpts = {}): Promise<RecipeDraft> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const { data: sess } = await supa.auth.getSession();
  // ③ (GO T4) : messages VISIBLES sans « IA/génération » — on nomme le geste.
  if (!sess.session) throw new Error('Connectez-vous pour mettre en forme une recette.');

  const { data, error } = await supa.functions.invoke('generate-recipe', {
    body: { intention, regles: opts.regles, adaptation: opts.adaptation },
  });
  if (error) {
    // Remonter le vrai message renvoyé par la fonction (sinon « non-2xx » opaque).
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const status = ctx?.status;
      const raw = ctx ? await ctx.text() : '';
      let msg = raw;
      try {
        const j = JSON.parse(raw);
        msg = j?.error || raw;
      } catch {
        /* pas du JSON : on garde le texte brut */
      }
      detail = `${status ?? ''} ${msg || error.message}`.trim();
    } catch {
      /* corps illisible : on garde le message générique */
    }
    throw new Error('Mise en forme : ' + detail);
  }
  if (!data || data.error) throw new Error(data?.error ?? 'Réponse vide.');
  return data.recipe as RecipeDraft;
}

export interface DarijaTranslation {
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
}

/**
 * Traduit nom/ingrédients/étapes vers la darija via l'edge function (figée au
 * moment de l'envoi). Renvoie null si indisponible (jamais bloquant).
 */
export async function translateToDarija(input: {
  nom?: string;
  ingredients?: string;
  etapes?: string;
}): Promise<DarijaTranslation | null> {
  try {
    if (!(await aiAvailable())) return null;
    const supa = getSupabase()!;
    const { data, error } = await supa.functions.invoke('generate-recipe', {
      body: { mode: 'translate', ...input },
    });
    if (error || !data || data.error || !data.translation) return null;
    return data.translation as DarijaTranslation;
  } catch {
    return null;
  }
}

/**
 * FC17 — Importe une recette depuis un texte collé (légende/blog) via l'edge
 * function (mode import, sortie structurée). Renvoie un brouillon « à valider ».
 */
export async function importRecipeText(text: string, opts: AdaptOpts = {}): Promise<RecipeDraft> {
  return importCall({ mode: 'import', text, regles: opts.regles, adaptation: opts.adaptation });
}

/** T4b — import PHOTO (page de livre, capture). L'image est le JPEG ≤1280px
 * ré-encodé par `prepareImage` (EXIF/GPS déjà supprimés côté client). */
export async function importRecipeImage(
  imageBase64: string,
  mediaType: string,
  opts: AdaptOpts = {},
): Promise<RecipeDraft> {
  return importCall({
    mode: 'import-image',
    image: imageBase64,
    media_type: mediaType,
    regles: opts.regles,
    adaptation: opts.adaptation,
  });
}

async function importCall(body: Record<string, unknown>): Promise<RecipeDraft> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const { data: sess } = await supa.auth.getSession();
  if (!sess.session) throw new Error('Connectez-vous pour importer une recette.');

  const { data, error } = await supa.functions.invoke('generate-recipe', { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const raw = ctx ? await ctx.text() : '';
      try {
        detail = JSON.parse(raw)?.error || raw || error.message;
      } catch {
        detail = raw || error.message;
      }
    } catch {
      /* garde le message générique */
    }
    throw new Error('Import : ' + detail);
  }
  if (!data || data.error || !data.recipe) throw new Error(data?.error ?? 'Réponse vide.');
  return data.recipe as RecipeDraft;
}

/** Vrai si la génération/traduction IA est utilisable maintenant (connecté + en ligne). */
export async function aiAvailable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const supa = getSupabase();
  if (!supa) return false;
  const { data } = await supa.auth.getSession();
  return !!data.session;
}
