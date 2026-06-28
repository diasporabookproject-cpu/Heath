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

/** Lundi de la semaine à `offset` semaines de la semaine courante. */
export function mondayOfOffset(offset: number): Date {
  const m = mondayOf();
  m.setDate(m.getDate() + offset * 7);
  return m;
}

/** Identifiant de semaine = date du lundi, format YYYY-MM-DD (clé locale stable). */
export function weekId(offset: number): string {
  const d = mondayOfOffset(offset);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Dates des 7 jours de la semaine à `offset`. */
export function weekDatesOffset(offset: number): Date[] {
  const m = mondayOfOffset(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(m);
    d.setDate(m.getDate() + i);
    return d;
  });
}

/** « Semaine du 23 juin » pour un offset. */
export function weekLabelOffset(offset: number): string {
  return `Semaine du ${dayLabel(mondayOfOffset(offset))}`;
}

/** Sous-titre relatif (cette semaine / prochaine / passée…). */
export function weekSub(offset: number): string {
  return offset === 0
    ? 'cette semaine'
    : offset === 1
      ? 'semaine prochaine'
      : offset === -1
        ? 'semaine passée'
        : offset > 0
          ? 'à venir'
          : 'passée';
}

/** « 23 juin » */
export function dayLabel(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
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
