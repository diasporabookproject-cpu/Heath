// Modèle métier — Cuisine v2 (brief FC11-FC19).

/**
 * MOMENT d'une recette (F5.2, lot Cuisine T5) : le jeu passe de 4 à 8, FERMÉ.
 * La clé stockée reste `role` — les recettes existantes gardent leur valeur
 * (migration = identité). Composition v1 inchangée (créneaux petitdej/entree/
 * plat/acc) : la soupe est éligible entrée ET plat au sélecteur (lib/picker) ;
 * dessert / goûter / boisson vivent en bibliothèque + fiche, sans créneau.
 */
export type RecipeRole =
  | 'petitdej'
  | 'entree'
  | 'plat'
  | 'acc'
  | 'dessert'
  | 'soupe'
  | 'gouter'
  | 'boisson';
export type RecipeStatus = 'Validé' | 'Écarté' | 'Test';

export const ROLE_LABEL: Record<RecipeRole, string> = {
  petitdej: 'Petit-déj',
  entree: 'Entrée',
  plat: 'Plat',
  acc: 'Accompagnement',
  dessert: 'Dessert',
  soupe: 'Soupe',
  gouter: 'Goûter',
  boisson: 'Boisson',
};

export interface Recipe {
  id: string;
  nom: string;
  /** Rôle (petit-déj / entrée / plat / accompagnement). */
  role: RecipeRole;
  statut: RecipeStatus;
  ingredients: string;
  /** Étapes de préparation (une par ligne). */
  etapes?: string;
  notes?: string;
  /** Née d'un « coup de main IA » (porte ③) → entre dans la file de relecture (L3-2/L3-3). */
  origineIA?: boolean;
  /** Provenance : id du pack de collections dont elle a été copiée (L3-4). */
  packId?: string;
  /** Favori (étoile). */
  fav?: boolean;
  /** Nombre de portions telles qu'écrites (T4/F4.2 ; affiché en tag F5.2). */
  portions?: number;
  /** Tags F5.2 optionnels (pastilles de fiche — omises si absentes). */
  cuisine?: string;
  difficulte?: string;
  temps?: string;
  /** G3 (F4.4) : règles du foyer appliquées à l'import — la DEMANDE, la trace vit
   * DANS le document et s'affiche à la relecture (« On a demandé d'adapter selon… »).
   * Fallback du bandeau v2 quand `adaptations` est absent (ancien edge). */
  adapteSelon?: string[];
  /** Prompt v2 (lot simplification T2) — RAPPORT du modèle : ce qu'il DÉCLARE
   * avoir changé pour respecter les règles. Optionnel = tolère l'ancien edge. */
  adaptations?: RecipeAdaptation[];
  /** Prompt v2 — quantités illisibles/absentes dans la source (jamais inventées). */
  quantites_incertaines?: string[];
  /** Prompt v2 — garde G3 lexical SERVEUR : interdit du foyer trouvé DANS les
   * ingrédients produits malgré la règle (→ bandeau rouge). */
  alerte_regles?: string[];
  /** Darija marocaine (lettres arabes), pour l'espace cuisinière. */
  nom_ar?: string;
  ingredients_ar?: string;
  etapes_ar?: string;
}

/** Prompt v2 — une modification déclarée par le modèle (regle concernée + action). */
export interface RecipeAdaptation {
  regle: string;
  action: string;
}

/** Recette d'un pack (L3-4) : recette complète SANS identité ni statut (copiée chez l'utilisateur à l'installation). */
export type RecipeSeed = Omit<Recipe, 'id' | 'statut' | 'fav' | 'packId' | 'origineIA' | 'notes'>;

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

/** Réglages Cuisine : nombre de personnes au foyer (mise à l'échelle des quantités). */
export interface CuisineSettings {
  /** Nombre de personnes au foyer (mise à l'échelle des quantités). */
  persons: number;
}

export const DEFAULT_SETTINGS: CuisineSettings = { persons: 4 };

/** Référence à un accompagnement avec sa quantité (en grammes). */
export interface AccRef {
  id: string;
  g: number;
}

export type MealKey = 'petitdej' | 'dej' | 'gouter' | 'diner';

/**
 * Un repas = conteneur de composants. `plat` = composant principal.
 * `entree` / `acc` optionnels (déjeuner & dîner seulement ; le petit-déjeuner
 * et le goûter n'ont que `plat` — ruling PO T3, lot UI).
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
  /** 4ᵉ moment (lot UI T3). OPTIONNEL À JAMAIS : les jours stockés avant le
   * changement — et ceux ramenés par la SYNC depuis un client ancien — n'ont
   * pas la clé. Tout lecteur DOIT tolérer son absence (tolérance
   * bidirectionnelle, leçon du lot simplification — pas de migration). */
  gouter?: MealSlot;
}

/** Une semaine = 7 jours, repérés par la clé du jour (lun, mar, …). */
export interface WeekMenu {
  /** Identifiant de semaine = date du lundi (YYYY-MM-DD) ; 'current' en v1. */
  id: string;
  days: Record<string, DayMenu>;
}

// ── Règles du foyer (lot Cuisine T3 · lot simplification : UN SEUL champ) ─────
// Réglage de COMPOSITION de recette posé au niveau du FOYER (jamais par personne),
// que le prompt lit pour adapter. Document unique synchronisé via `docs` (store
// 'foyer') — LWW, lisible hors-ligne. La fiche enfant Nounou ne bouge pas (D2).
// Lot simplification : `regime` + `allergies` fusionnés en `nePasManger` (liste
// libre, « ce que le foyer ne mange pas ») — supprime par construction le double
// « sans » (« sans Sans gluten »). `halal` reste un TOGGLE (concept fermé/composé :
// pas de porc + alcool + viande halal — le prompt le traite structurellement).
export interface ReglesFoyer {
  halal: boolean;
  /** Ce que le foyer ne mange pas — une entrée par ligne, brute (« gluten », « porc »…). */
  nePasManger: string[];
}

export const EMPTY_REGLES: ReglesFoyer = { halal: false, nePasManger: [] };

/** Y a-t-il au moins une restriction posée ? (état vide = légal, F3.1) */
export function reglesActives(r: ReglesFoyer): boolean {
  return r.halal || r.nePasManger.length > 0;
}

/** Les règles en liste lisible (« halal · gluten · arachide ») — même format
 * partout : Réglages (G1), ligne d'import (F4.4), trace de relecture (G3). */
export function reglesList(r: ReglesFoyer): string[] {
  return [r.halal ? 'halal' : null, ...r.nePasManger].filter((x): x is string => !!x);
}

/** Migration idempotente (lot simplification) : ancien format `{allergies, halal,
 *  regime}` (IDB locale OU payload sync d'un appareil pas à jour) → `{halal,
 *  nePasManger}`. Appliquée aux DEUX portes : `loadFoyerRegles` + `applyRemote`. */
export function normalizeRegles(r: unknown): ReglesFoyer {
  if (!r || typeof r !== 'object') return { ...EMPTY_REGLES };
  const o = r as Record<string, unknown>;
  if (Array.isArray(o.nePasManger)) {
    return { halal: !!o.halal, nePasManger: (o.nePasManger as unknown[]).map(String) };
  }
  const allergies = Array.isArray(o.allergies) ? (o.allergies as unknown[]).map(String) : [];
  const regime = typeof o.regime === 'string' && o.regime ? [o.regime] : [];
  return { halal: !!o.halal, nePasManger: [...regime, ...allergies] };
}

/** Destinataire d'un brief (personnel de maison). Concept transverse réutilisable. */
/** Tâche libre de la checklist (texte de l'employeur — fr seul, décision ③). */
export interface TaskItem {
  id: string;
  t: string;
}

export interface Destinataire {
  id: string;
  nom: string;
  /** Rôle indicatif : Cuisinière / Femme de ménage / Nounou / Autre. */
  role: string;
  /** Langue de lecture — vocabulaire du CATALOGUE (cf. D6 sur NounouLangue) :
   *  `'dr'` = darija. L'ancien code Cuisine `'ar'` (qui SIGNIFIAIT darija) est
   *  migré à la lecture (`normalizeDestLangue`) ; sur le FIL publié (payload
   *  `espaces` v:1), la darija reste `'ar'` pour toujours (`wireLangue`) —
   *  compat perpétuelle des liens distribués. */
  langue: 'fr' | 'dr';
  /** Jeton d'accès (capability) pour le lien permanent de son espace. */
  token: string;
  /** Téléphone (format international, ex. 2126…) pour le rappel WhatsApp. */
  tel?: string;
  /** Ids des fiches Sécurité assignées à cette personne. */
  securiteIds?: string[];
  /** T3 (lot partage) : suivi des tâches activé pour cette personne. */
  checklist?: boolean;
  /** Tâches libres, publiées avec la page quand la checklist est active. */
  tasks?: TaskItem[];
  // `revoked?` supprimé (mini-lot destinataires F2) : jamais câblé, et la
  // révocation SUPPRIME la personne (couper/créer) — un drapeau sur un
  // enregistrement qui disparaît est mort par construction. Soft-revoke = A7-C2.
  createdAt: number;
}

// ── Remappage langue (mini-lot destinataires T2) ─────────────────────────────
// Côté Cuisine, `'ar'` signifiait DARIJA ; côté catalogue, `'dr'` = darija et
// `'ar'` = arabe standard. Sans remap, l'élargissement D5 aurait fait basculer
// tous les destinataires `'ar'` de la darija vers l'arabe classique EN SILENCE.

/** Migration idempotente du code langue d'un Destinataire : `'ar'` legacy → `'dr'`. */
export function normalizeDestLangue(l: string): 'fr' | 'dr' {
  return l === 'dr' || l === 'ar' ? 'dr' : 'fr';
}

/** Normalise un destinataire (IDB locale OU payload sync d'un appareil pas à jour). */
export function normalizeDestinataire(d: Destinataire): Destinataire {
  const langue = normalizeDestLangue(d.langue as string);
  return langue === d.langue ? d : { ...d, langue };
}

/** Code langue sur le FIL publié (payload `espaces` v:1) : la darija y est `'ar'`,
 *  pour toujours — les liens distribués sont perpétuels. L'arabe standard n'a PAS
 *  de code en v:1 ; l'élargissement D5 passera par `v: 2` (cf. ETAT.md § Ouvert). */
export function wireLangue(l: 'fr' | 'dr'): 'fr' | 'ar' {
  return l === 'dr' ? 'ar' : 'fr';
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

/** Langues disponibles pour la page reçue — LE catalogue (D5, liste fermée), et
 * sa sémantique (D6, fixée par la fiche de remappage T2 — personne d'autre ne le fera) :
 *   `'fr'` = français · `'dr'` = darija marocaine (lettres arabes) ·
 *   `'ar'` = **arabe standard moderne (fusha)** — libellé UI « Arabe classique »,
 *   JAMAIS le registre coranique (une consigne d'urgence se lit en MSA) ·
 *   `'en'` = anglais.
 * ⚠️ Ne pas confondre avec le FIL Cuisine (`wireLangue`) où `'ar'` = darija (v:1). */
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

/**
 * 🔴 Les noms de langue s'écrivent EN FRANÇAIS (décision PO, lot partage simplifié).
 * Ce ne sont pas des étiquettes décoratives : elles servent à CHOISIR la langue de
 * son destinataire — quelqu'un qui ne lit pas l'arabe doit pouvoir le faire. Quatre
 * mots français, jamais quatre écritures. `rtl` reste la vérité technique du RENDU
 * (la page reçue, elle, s'écrit bien en arabe).
 */
export const NOUNOU_LANGS: NounouLangInfo[] = [
  { code: 'fr', nom: 'Français', sub: "Langue d'auteur", rtl: false, author: true },
  { code: 'dr', nom: 'Darija', sub: 'Marocain', rtl: true },
  { code: 'ar', nom: 'Arabe', sub: 'Arabe classique', rtl: true },
  { code: 'en', nom: 'Anglais', sub: 'À activer si besoin', rtl: false },
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
