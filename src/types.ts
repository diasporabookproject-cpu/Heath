// Modèle métier — voir BRIEF_PRODUIT.md §4

export type RecipeType = 'Déjeuner' | 'Dîner' | 'Coupe-faim';
export type RecipeStatus = 'Validé' | 'Écarté' | 'Test';
export type CalciumFlag = 'Champion' | 'Moyen' | 'Faible';
export type DayType = 'Repos' | 'Cardio' | 'Muscu';

export interface Recipe {
  id: string;
  nom: string;
  type: RecipeType;
  statut: RecipeStatus;
  /** Jour adapté indicatif : 'Tous' | 'Repos' | 'Sport' */
  jour: string;
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
  flag_calcium: CalciumFlag;
  ingredients: string;
  notes?: string;
  /** Nom en darija marocaine (lettres arabes), pour la vue Cuisinière. */
  nom_ar?: string;
  /** Ingrédients en darija marocaine (lettres arabes). */
  ingredients_ar?: string;
}

export interface DayConfig {
  key: string;
  nom: string;
  type: DayType;
  cible_kcal: number;
}

/** Macros d'un élément (élément fixe, ou total agrégé). */
export interface Macros {
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
}

export interface FixedElements {
  collation: Macros;
  kefir_coucher: Macros;
}

export interface Cibles {
  kcal_par_type: Record<DayType, number>;
  kcal_seuils_pct: { vert: number; orange: number };
  proteines: { vert: number; orange: number };
  calcium: { vert: number; orange: number };
}

export interface AppConfig {
  jours: DayConfig[];
  elements_fixes: FixedElements;
  cibles: Cibles;
  repas_verrouilles_suggeres?: Record<string, string>;
}

/** Composition d'une journée : un déjeuner, un dîner, et des extras optionnels (ex. Creami). */
export interface DayMenu {
  dejId: string | null;
  dinId: string | null;
  /** ids de recettes Coupe-faim ajoutées en extra (comptées dans les totaux). */
  extras: string[];
  /** Type du jour ajusté par l'utilisateur (⚙ jour). Sinon = type de la config. */
  type?: DayType;
  /** Créneaux verrouillés : ignorés par le générateur et le remplacement (⤧). */
  lockDej?: boolean;
  lockDin?: boolean;
}

/** Une semaine = 7 jours composés, repérés par la clé du jour (lun, mar, …). */
export interface WeekMenu {
  id: string;
  /** clé jour -> composition */
  days: Record<string, DayMenu>;
}

export type Feu = 'vert' | 'orange' | 'rouge';

/** Destinataire d'un brief (personnel de maison). Concept transverse réutilisable. */
export interface Destinataire {
  id: string;
  nom: string;
  /** Rôle indicatif : Cuisinière / Femme de ménage / Nounou / Autre. */
  role: string;
  /** Langue de lecture préférée. */
  langue: 'fr' | 'ar';
  /** Jeton d'accès (capability) pour le lien permanent de son espace. */
  token: string;
  /** Ids des fiches Sécurité assignées à cette personne (« qui reçoit quoi »). */
  securiteIds?: string[];
  revoked?: boolean;
  createdAt: number;
}

export type SecuriteType = 'numeros' | 'procedure' | 'gestes';

/**
 * Fiche du référentiel Sécurité (consignes du foyer). Contenu = lignes
 * (une par item), darija en parallèle. AUCUNE génération IA (D7).
 * - numeros   : « Label : numéro » par ligne
 * - procedure : une étape par ligne (ordre = ordre des lignes)
 * - gestes    : un geste par ligne ; préfixe « - » = interdit, sinon permis
 */
export interface SecuriteFiche {
  id: string;
  type: SecuriteType;
  titre: string;
  titre_ar?: string;
  contenu: string;
  contenu_ar?: string;
  statut: RecipeStatus; // Validé / Test / Écarté(=archivé)
  createdAt: number;
}
