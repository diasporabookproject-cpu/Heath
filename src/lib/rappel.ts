import type { Rappel } from './db';

// Rappel d'envoi (L3-5) — v1 SANS notification système : simple mention in-app,
// déclenchée à l'ouverture / au retour de focus. Logique d'échéance PURE & testée.
// Convention `Rappel.day` : 0 = lundi … 6 = dimanche.

export const DAY_LABELS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const RAPPEL_TIMES = ['8:00', '9:00', '18:00', '20:00'];

/** « Chaque samedi à 9:00 ». */
export function rappelLabel(r: Rappel): string {
  return `Chaque ${DAY_LABELS[r.day] ?? '?'} à ${r.time}`;
}

/** Occurrence hebdo la plus récente (jour+heure) à ou avant `now`, sinon null. */
function lastOccurrence(r: Rappel, now: Date): Date | null {
  const [h, m] = r.time.split(':').map(Number);
  const targetJs = (r.day + 1) % 7; // 0=lundi… → getDay() 0=dimanche…
  for (let d = 0; d <= 7; d++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, h, m, 0, 0);
    if (dt.getDay() === targetJs && dt.getTime() <= now.getTime()) return dt;
  }
  return null;
}

/**
 * Le rappel est-il « dû » ? = une échéance (jour+heure) est passée **depuis le
 * dernier passage** (`lastCheckISO`). Sans dernier passage : dû dès qu'une
 * échéance existe dans le passé.
 */
export function reminderDue(r: Rappel, lastCheckISO: string | undefined, now: Date): boolean {
  const occ = lastOccurrence(r, now);
  if (!occ) return false;
  if (!lastCheckISO) return true;
  return occ.getTime() > new Date(lastCheckISO).getTime();
}
