import { getSupabase } from './supabase';

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
  nom_ar?: string;
  ingredients_ar?: string;
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
