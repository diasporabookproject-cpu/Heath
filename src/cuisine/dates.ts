// Dates de la semaine en cours (lundi → dimanche), pour l'affichage FC2.
// Lecture seule : on n'a qu'une « semaine courante » (multi-semaines hors lot 1).

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Lundi de la semaine contenant `ref` (par défaut aujourd'hui). */
export function mondayOf(ref: Date = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - dow);
  return d;
}

/** Dates des 7 jours (lun→dim) de la semaine courante, dans l'ordre des clés de config. */
export function weekDates(ref: Date = new Date()): Date[] {
  const m = mondayOf(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(m);
    d.setDate(m.getDate() + i);
    return d;
  });
}

/** « 23 juin » */
export function dayLabel(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** « Semaine du 23 juin » */
export function weekLabel(ref: Date = new Date()): string {
  return `Semaine du ${dayLabel(mondayOf(ref))}`;
}

const KEYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/** Clé du jour courant (lun…dim) pour repérer « aujourd'hui ». */
export function todayKey(ref: Date = new Date()): string {
  return KEYS[ref.getDay()];
}

/** « Mardi 24 juin » (jour + date, capitalisé). */
export function todayLabel(ref: Date = new Date()): string {
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return `${jours[ref.getDay()]} ${dayLabel(ref)}`;
}
