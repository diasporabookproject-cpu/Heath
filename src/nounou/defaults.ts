// Jeu de départ Nounou (anti-page-blanche, §1.2). Tout est éditable par le parent
// et ne fait qu'amorcer la page : un rythme plausible, deux enfants, les numéros
// d'urgence Maroc « à vérifier ». Aucun conseil médical n'est généré (§1.8).

import type { NounouDoc, UrgenceFiche } from '../types';

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

/** Jeu de départ : amorce la page sans imposer une semaine entière. */
export function seedNounouDoc(): NounouDoc {
  const doc = emptyNounouDoc();
  const a = uid();
  const b = uid();
  doc.enfants = [
    { id: a, prenom: 'Yasmine', initiale: 'Y', couleur: ENFANT_COULEURS[0] },
    { id: b, prenom: 'Adam', initiale: 'A', couleur: ENFANT_COULEURS[1] },
  ];
  doc.rythme = [
    { id: uid(), label: 'École', heure: '08:00', type: 'ecole', jours: JOURS_ECOLE, enfants: [], lieu: 'École' },
    { id: uid(), label: 'Déjeuner', heure: '12:30', type: 'repas', jours: TOUS_LES_JOURS, enfants: [] },
    { id: uid(), label: 'Sieste', heure: '14:00', type: 'sieste', jours: TOUS_LES_JOURS, enfants: [b] },
    { id: uid(), label: 'Goûter', heure: '16:30', type: 'gouter', jours: TOUS_LES_JOURS, enfants: [] },
    { id: uid(), label: 'Coucher', heure: '20:30', type: 'coucher', jours: TOUS_LES_JOURS, enfants: [] },
  ];
  // Un destinataire de départ (anti-page-blanche) : la nounou, scopée à tous.
  doc.destinataires = [
    {
      id: uid(),
      prenom: 'Khadija',
      role: 'Nounou',
      langue: 'fr',
      enfants: [],
      token: newToken(),
      createdAt: 0,
    },
  ];
  return doc;
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
  };
}
