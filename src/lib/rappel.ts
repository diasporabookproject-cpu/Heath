import type { Rappel } from './db';

// Rappel d'envoi (L3-5) — v1 SANS notification système : la mention in-app
// « ton rendez-vous du {jour} {heure} » reste sur la carte Maison tant qu'un
// rappel est réglé et qu'il y a du nouveau (option B, fidèle au prototype).
// Convention `Rappel.day` : 0 = lundi … 6 = dimanche.

export const DAY_LABELS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const RAPPEL_TIMES = ['8:00', '9:00', '18:00', '20:00'];

/** « Chaque samedi à 9:00 ». */
export function rappelLabel(r: Rappel): string {
  return `Chaque ${DAY_LABELS[r.day] ?? '?'} à ${r.time}`;
}
