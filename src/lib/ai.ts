import { getSupabase } from './supabase';
import { estimateMacrosLocal, calciumFlag, type MacroEstimate } from './macros';

// Appel de l'edge function de génération de recette (relais Claude).
// Renvoie un objet brouillon (champs recette) ; l'humain valide ensuite.

export interface RecipeDraft {
  nom?: string;
  type?: string;
  jour?: string;
  kcal?: number;
  prot?: number;
  gluc?: number;
  lip?: number;
  calcium?: number;
  flag_calcium?: string;
  ingredients?: string;
  etapes?: string;
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
}

export async function generateRecipeDraft(intention: string): Promise<RecipeDraft> {
  const supa = getSupabase();
  if (!supa) throw new Error('Synchro non configurée.');
  const { data: sess } = await supa.auth.getSession();
  if (!sess.session) throw new Error('Connecte-toi (☁︎) pour utiliser la génération IA.');

  const { data, error } = await supa.functions.invoke('generate-recipe', {
    body: { intention },
  });
  if (error) {
    // 404 = fonction non déployée ; message lisible.
    throw new Error(
      "Génération indisponible (l'edge function n'est peut-être pas déployée). " + error.message,
    );
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

/** Vrai si la génération/estimation IA est utilisable maintenant (connecté + en ligne). */
export async function aiAvailable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const supa = getSupabase();
  if (!supa) return false;
  const { data } = await supa.auth.getSession();
  return !!data.session;
}

interface MacrosOut {
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
  flag_calcium: 'Champion' | 'Moyen' | 'Faible';
  source: 'ia' | 'local';
}

/**
 * Auto-macros (2.3) : estime les macros d'une portion à partir des ingrédients.
 * Préfère l'edge function (LLM) si disponible ; sinon repli sur la base locale.
 * Ne lève JAMAIS — renvoie toujours une estimation (« ne jamais bloquer »).
 */
export async function estimateMacros(ingredients: string, type?: string): Promise<MacrosOut> {
  const local = (): MacrosOut => {
    const m: MacroEstimate = estimateMacrosLocal(ingredients);
    return {
      kcal: m.kcal,
      prot: m.prot,
      gluc: m.gluc,
      lip: m.lip,
      calcium: m.calcium,
      flag_calcium: m.flag_calcium,
      source: 'local',
    };
  };

  try {
    if (!(await aiAvailable())) return local();
    const supa = getSupabase()!;
    const { data, error } = await supa.functions.invoke('generate-recipe', {
      body: { mode: 'estimate', ingredients, type },
    });
    if (error || !data || data.error || !data.macros) return local();
    const m = data.macros;
    const calcium = Math.round(Number(m.calcium) || 0);
    return {
      kcal: Math.round(Number(m.kcal) || 0),
      prot: Math.round(Number(m.prot) || 0),
      gluc: Math.round(Number(m.gluc) || 0),
      lip: Math.round(Number(m.lip) || 0),
      calcium,
      flag_calcium:
        (m.flag_calcium as MacrosOut['flag_calcium']) || calciumFlag(calcium),
      source: 'ia',
    };
  } catch {
    return local();
  }
}
