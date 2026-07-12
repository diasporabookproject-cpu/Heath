// Jeu de départ Nounou (anti-page-blanche, §1.2). Tout est éditable par le parent
// et ne fait qu'amorcer la page : un rythme plausible, deux enfants, les numéros
// d'urgence Maroc « à vérifier ». Aucun conseil médical n'est généré (§1.8).

import type { ConduiteCateg, NounouDoc, UrgenceFiche } from '../types';

/** Identifiant local court, stable et non devinable. */
export function uid(): string {
  const r = globalThis.crypto?.randomUUID?.();
  if (r) return r.replace(/-/g, '').slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

/** Jeton capability long (lien permanent #e=…), même format que la Cuisine. */
export function newToken(): string {
  return (uid() + uid() + uid() + uid()).slice(0, 40);
}

/** Jours d'école = lundi→vendredi (0..4) ; tous les jours = 0..6. */
export const JOURS_ECOLE = [0, 1, 2, 3, 4];
export const TOUS_LES_JOURS = [0, 1, 2, 3, 4, 5, 6];

/** Palette d'accents pour les enfants (lisible sur fond clair). */
export const ENFANT_COULEURS = ['#1e4d45', '#b6791c', '#7a5aa6', '#9a3b3b', '#2f6f8f', '#6b7a2f'];

/** Modèles de conduites « à compléter » par le parent (aucun conseil généré, §1.8). */
export const CONDUITE_MODELES: { titre: string; categ: ConduiteCateg; urgent?: boolean }[] = [
  { titre: 'Fièvre', categ: 'sante' },
  { titre: 'Petite blessure / chute', categ: 'sante' },
  { titre: 'Étouffement', categ: 'sante', urgent: true },
  { titre: 'Réaction allergique', categ: 'sante', urgent: true },
  { titre: 'Refus de manger', categ: 'quotidien' },
  { titre: 'Étranger à la porte', categ: 'securite' },
];

/** Numéros d'urgence Maroc — affichés avec la mention « à vérifier » (§FN3.1). */
const NUMEROS_MAROC: UrgenceFiche['numeros'] = [
  { label: 'Police', numero: '19', aVerifier: true },
  { label: 'SAMU', numero: '15', aVerifier: true },
  { label: 'Pompiers', numero: '150', aVerifier: true },
];

/** Document vide (référence de fusion pour la compat ascendante). */
export function emptyNounouDoc(): NounouDoc {
  return {
    enfants: [],
    rythme: [],
    periodes: [],
    ponctuels: [],
    conduites: [],
    urgence: { numeros: NUMEROS_MAROC.map((n) => ({ ...n })), contacts: [], regles: [] },
    destinataires: [],
  };
}

/** Jeu de départ (Flow FTUE, F1) : plus AUCUN contenu personnel pré-créé — un nouveau
 * foyer démarre VIDE (enfants, rythme, destinataire, gabarits). Le peuplement est
 * désormais OPT-IN : FTUE (« Les enfants » → gabarits, F3) ou boutons d'import. Seuls
 * restent les numéros d'urgence Maroc « à vérifier » (info pays générique, portée par
 * `emptyNounouDoc` — pas du personnel). Appareils existants : jamais re-seedés (leur
 * doc existe), donc intouchés. */
export function seedNounouDoc(): NounouDoc {
  return emptyNounouDoc();
}

/** F3 — gabarits de conduites encore ABSENTS du doc (anti-doublon par TITRE,
 * insensible à la casse). Pur et testable ; la matérialisation passe par le store
 * (`useNounou.installConduiteModeles`), la FTUE ou le bouton d'import de Conduites. */
export function missingConduiteModeles(existing: { titre: string }[]): typeof CONDUITE_MODELES {
  const have = new Set(existing.map((c) => c.titre.trim().toLowerCase()));
  return CONDUITE_MODELES.filter((m) => !have.has(m.titre.trim().toLowerCase()));
}

/** Fusionne un document chargé avec les valeurs par défaut (compat ascendante). */
export function mergeNounouDoc(loaded: Partial<NounouDoc> | undefined): NounouDoc {
  const base = emptyNounouDoc();
  if (!loaded) return base;
  return {
    enfants: loaded.enfants ?? base.enfants,
    rythme: loaded.rythme ?? base.rythme,
    periodes: loaded.periodes ?? base.periodes,
    ponctuels: loaded.ponctuels ?? base.ponctuels,
    conduites: loaded.conduites ?? base.conduites,
    urgence: {
      numeros: loaded.urgence?.numeros ?? base.urgence.numeros,
      contacts: loaded.urgence?.contacts ?? base.urgence.contacts,
      regles: loaded.urgence?.regles ?? base.urgence.regles,
    },
    destinataires: loaded.destinataires ?? base.destinataires,
    translations: loaded.translations,
  };
}
