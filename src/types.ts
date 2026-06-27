// Modèle métier — Cuisine v2 (brief FC11-FC19).

/** Rôle d'une recette : sert au filtrage et à la composition des repas. */
export type RecipeRole = 'petitdej' | 'entree' | 'plat' | 'acc';
export type RecipeStatus = 'Validé' | 'Écarté' | 'Test';
export type CalciumFlag = 'Champion' | 'Moyen' | 'Faible';

export const ROLE_LABEL: Record<RecipeRole, string> = {
  petitdej: 'Petit-déj',
  entree: 'Entrée',
  plat: 'Plat',
  acc: 'Accompagnement',
};

export interface Recipe {
  id: string;
  nom: string;
  /** Rôle (petit-déj / entrée / plat / accompagnement). */
  role: RecipeRole;
  statut: RecipeStatus;
  /**
   * Macros : PAR PORTION (1 portion = 1 personne) pour petitdej/entree/plat ;
   * PAR 100 g pour les accompagnements (role === 'acc').
   */
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
  flag_calcium: CalciumFlag;
  ingredients: string;
  /** Étapes de préparation (une par ligne). */
  etapes?: string;
  notes?: string;
  /** Macros estimées automatiquement et non encore vérifiées (auto-macros). */
  macros_estimees?: boolean;
  /** Favori (étoile). */
  fav?: boolean;
  /** Darija marocaine (lettres arabes), pour l'espace cuisinière. */
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
}

/** Jour de la semaine (clé + libellé). Plus de type de jour ni de cible (v2). */
export interface DayConfig {
  key: string;
  nom: string;
}

export interface AppConfig {
  jours: DayConfig[];
}

/** Réglages Cuisine : objectif calorique individuel + nombre de personnes au foyer. */
export interface CuisineSettings {
  /** Objectif calorique PAR PERSONNE / jour (plafond). */
  objective: number;
  /** Nombre de personnes au foyer (mise à l'échelle des quantités). */
  persons: number;
}

export const DEFAULT_SETTINGS: CuisineSettings = { objective: 1800, persons: 4 };

/** Macros agrégées. */
export interface Macros {
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
}

/** Référence à un accompagnement avec sa quantité (en grammes). */
export interface AccRef {
  id: string;
  g: number;
}

export type MealKey = 'petitdej' | 'dej' | 'diner';

/**
 * Un repas = conteneur de composants. `plat` = composant principal.
 * `entree` / `acc` optionnels (déjeuner & dîner seulement ; le petit-déjeuner
 * n'a que `plat`).
 */
export interface MealSlot {
  plat: string | null;
  entree?: string | null;
  acc?: AccRef | null;
}

export interface DayMenu {
  petitdej: MealSlot;
  dej: MealSlot;
  diner: MealSlot;
}

/** Une semaine = 7 jours, repérés par la clé du jour (lun, mar, …). */
export interface WeekMenu {
  /** Identifiant de semaine = date du lundi (YYYY-MM-DD) ; 'current' en v1. */
  id: string;
  days: Record<string, DayMenu>;
}

export type Feu = 'vert' | 'orange' | 'rouge';

/** Destinataire d'un brief (personnel de maison). Concept transverse réutilisable. */
export interface Destinataire {
  id: string;
  nom: string;
  /** Rôle indicatif : Cuisinière / Femme de ménage / Nounou / Autre. */
  role: string;
  langue: 'fr' | 'ar';
  /** Jeton d'accès (capability) pour le lien permanent de son espace. */
  token: string;
  /** Téléphone (format international, ex. 2126…) pour le rappel WhatsApp. */
  tel?: string;
  /** Ids des fiches Sécurité assignées à cette personne. */
  securiteIds?: string[];
  revoked?: boolean;
  createdAt: number;
}

export type SecuriteType = 'numeros' | 'procedure' | 'gestes';

/**
 * Fiche du référentiel Sécurité (consignes du foyer). Contenu = lignes,
 * darija en parallèle. AUCUNE génération IA.
 */
export interface SecuriteFiche {
  id: string;
  type: SecuriteType;
  titre: string;
  titre_ar?: string;
  contenu: string;
  contenu_ar?: string;
  statut: RecipeStatus;
  createdAt: number;
}
