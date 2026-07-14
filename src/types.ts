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
  /** Née d'un « coup de main IA » (porte ③) → entre dans la file de relecture (L3-2/L3-3). */
  origineIA?: boolean;
  /** Provenance : id du pack de collections dont elle a été copiée (L3-4). */
  packId?: string;
  /** Favori (étoile). */
  fav?: boolean;
  /** Darija marocaine (lettres arabes), pour l'espace cuisinière. */
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
}

/** Recette d'un pack (L3-4) : recette complète SANS identité ni statut (copiée chez l'utilisateur à l'installation). */
export type RecipeSeed = Omit<Recipe, 'id' | 'statut' | 'fav' | 'packId' | 'origineIA' | 'macros_estimees' | 'notes'>;

/** Collection / pack éditorial de recettes prêtes (L3-4). Format réutilisable. */
export interface Pack {
  id: string;
  nom: string;
  emoji: string;
  description: string;
  version: number;
  recettes: RecipeSeed[];
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

// ── Règles du foyer (lot Cuisine T3, F3.1 — décision D2 : UN SEUL endroit) ────
// Restrictions posées au niveau du FOYER (jamais par personne) : appliquées aux
// prochains imports de recettes (T4/F4.4) et signalées sur la page reçue
// (T5/F5.5). Document unique synchronisé via `docs` (store 'foyer', façon
// nounou) — LWW par document, lisible hors-ligne. La fiche enfant Nounou ne
// bouge pas (passerelle parquée, D2).
export interface ReglesFoyer {
  /** Allergies / interdits libres (une entrée par ligne à la saisie). */
  allergies: string[];
  halal: boolean;
  /** Régime du foyer (extensible) — 'végétarien' pour l'instant, null sinon. */
  regime: string | null;
}

export const EMPTY_REGLES: ReglesFoyer = { allergies: [], halal: false, regime: null };

/** Y a-t-il au moins une restriction posée ? (état vide = légal, F3.1) */
export function reglesActives(r: ReglesFoyer): boolean {
  return r.allergies.length > 0 || r.halal || r.regime !== null;
}

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

// ── Nounou (page par rôle, brief FN0-FN5) ────────────────────────────────────
// Modèle en couches, précédence stricte : ponctuel > période > rythme habituel.
// Stockage : document JSON unique en local-first (IndexedDB), synchro `espaces`.

/** Catégorie d'un moment (icône + filtrage visuel). */
export type MomentType =
  | 'reveil'
  | 'ecole'
  | 'repas'
  | 'sieste'
  | 'gouter'
  | 'bain'
  | 'sortie'
  | 'sante'
  | 'coucher'
  | 'activite'
  | 'autre';

export const MOMENT_LABEL: Record<MomentType, string> = {
  reveil: 'Réveil',
  ecole: 'École',
  repas: 'Repas',
  sieste: 'Sieste',
  gouter: 'Goûter',
  bain: 'Bain',
  sortie: 'Sortie',
  sante: 'Santé',
  coucher: 'Coucher',
  activite: 'Activité',
  autre: 'Autre',
};

/** Fiche d'un enfant (Lot 3). Tout est rédigé par le parent. */
export interface EnfantFiche {
  allergies?: string;
  traitement?: string;
  medecin?: string;
  groupe?: string;
  habitudes?: string;
}

/** Un enfant du foyer. */
export interface Enfant {
  id: string;
  prenom: string;
  initiale: string;
  /** Couleur d'accent (badge/initiale). */
  couleur: string;
  fiche?: EnfantFiche;
}

/** Une ligne récurrente du planning (école, sieste, coucher). */
export interface Moment {
  id: string;
  label: string;
  /** Heure au format HH:MM (tri). */
  heure: string;
  type: MomentType;
  /** Jours de semaine concernés, 0..6 (0 = lundi). */
  jours: number[];
  /** Ids d'enfants concernés ; vide = tous. */
  enfants: string[];
  qui?: string;
  lieu?: string;
  note?: string;
}

/** Un rythme alternatif sur une plage de dates (vacances, Ramadan, voyage). */
export interface Periode {
  id: string;
  nom: string;
  emoji: string;
  /** Date de début incluse (YYYY-MM-DD). */
  debut: string;
  /** Date de fin incluse (YYYY-MM-DD). */
  fin: string;
  note?: string;
  /** Rythme propre à la période (copie ajustable du rythme habituel). */
  rythme: Moment[];
}

/** Un événement sur un seul jour, par-dessus le rythme (ne le modifie pas). */
export interface Ponctuel {
  id: string;
  /** Jour concerné (YYYY-MM-DD). */
  date: string;
  label: string;
  heure: string;
  type: MomentType;
  enfants: string[];
  lieu?: string;
  qui?: string;
}

/** Conduite (« que faire si… ») rédigée par le parent — aucun conseil généré. */
export type ConduiteCateg = 'sante' | 'securite' | 'quotidien';

export const CONDUITE_LABEL: Record<ConduiteCateg, string> = {
  sante: 'Santé',
  securite: 'Sécurité',
  quotidien: 'Quotidien',
};

export interface Conduite {
  id: string;
  titre: string;
  categ: ConduiteCateg;
  urgent?: boolean;
  /** Gabarit en attente de rédaction par le parent. */
  aCompleter?: boolean;
  /** Étapes numérotées (une par ligne). */
  etapes: string;
  quiAppeler?: string;
  /** URL publique de la consigne vocale (renseignée seulement dans le payload publié). */
  voix?: string;
  createdAt: number;
}

/** Contact d'urgence (appel au tap). */
export interface NounouContact {
  id: string;
  nom: string;
  tel: string;
  role?: string;
}

/** Règle / autorisation (autorisé vs interdit). */
export interface ReglePerm {
  id: string;
  texte: string;
  permis: boolean;
}

/** Numéro d'urgence (mention « à vérifier » par défaut). */
export interface NumeroUrgence {
  label: string;
  numero: string;
  aVerifier?: boolean;
}

/** Onglet Fiche urgence (Lot 3). */
export interface UrgenceFiche {
  numeros: NumeroUrgence[];
  contacts: NounouContact[];
  regles: ReglePerm[];
}

/** Langues disponibles pour la page reçue (darija distincte de l'arabe standard). */
export type NounouLangue = 'fr' | 'dr' | 'ar' | 'en';

export interface NounouLangInfo {
  code: NounouLangue;
  nom: string;
  sub: string;
  /** Sens d'écriture droite→gauche (arabe / darija). */
  rtl: boolean;
  /** Langue d'auteur (source de vérité). */
  author?: boolean;
}

export const NOUNOU_LANGS: NounouLangInfo[] = [
  { code: 'fr', nom: 'Français', sub: "Langue d'auteur", rtl: false, author: true },
  { code: 'dr', nom: 'الدارجة', sub: 'Marocain', rtl: true },
  { code: 'ar', nom: 'العربية', sub: 'Standard', rtl: true },
  { code: 'en', nom: 'English', sub: 'À activer si besoin', rtl: false },
];

/** Destinataire de la page Nounou : lien durable scopé (enfants, rôle, langue). */
export interface NounouDest {
  id: string;
  prenom: string;
  role: string;
  langue: NounouLangue;
  /** Enfants scopés ; vide = tous. */
  enfants: string[];
  tel?: string;
  /** Jeton capability du lien permanent (#e=…). */
  token: string;
  createdAt: number;
}

/** Statut d'une traduction : auto (non-sensible, actif) / à valider / validé. */
export type TransStatus = 'auto' | 'aValider' | 'valide';

export interface TransEntry {
  /** Texte traduit. */
  tr: string;
  /** Contenu sensible (santé/urgences/conduites/allergies) → relecture requise. */
  sensible: boolean;
  status: TransStatus;
}

/** Cache de traductions par langue : { langue: { texte source: entrée } }. */
export type TransCache = Partial<Record<NounouLangue, Record<string, TransEntry>>>;

/** Document Nounou unique (local-first, source de vérité). */
export interface NounouDoc {
  enfants: Enfant[];
  /** Rythme habituel : socle des moments récurrents. */
  rythme: Moment[];
  periodes: Periode[];
  ponctuels: Ponctuel[];
  conduites: Conduite[];
  urgence: UrgenceFiche;
  destinataires: NounouDest[];
  /** Traductions dérivées (figées), par langue. La langue d'auteur reste le français. */
  translations?: TransCache;
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
