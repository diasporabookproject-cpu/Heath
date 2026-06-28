// Helpers de dates propres à la page Nounou (modèle par date YYYY-MM-DD).
// Réutilise la convention 0 = lundi, alignée avec Cuisine.

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
/** Abréviations 0=lundi…6=dimanche. */
export const SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MOIS_COURT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** Date du jour au format YYYY-MM-DD (heure locale). */
export function todayISO(ref: Date = new Date()): string {
  return toISO(ref);
}

/** Convertit une Date en YYYY-MM-DD (heure locale, sans décalage UTC). */
export function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Parse YYYY-MM-DD en Date locale (minuit). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Décale une date ISO de `days` jours. */
export function addDaysISO(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** « Mardi 24 juin » (jour + date, capitalisé) pour une date ISO. */
export function dayTitleISO(iso: string): string {
  const d = fromISO(iso);
  const wd = (d.getDay() + 6) % 7; // 0 = lundi
  return `${JOURS[wd]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** « 24 juin » court. */
export function dayShortISO(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** Numéro du jour (1..31) d'une date ISO. */
export function dayNumberISO(iso: string): number {
  return fromISO(iso).getDate();
}

/** Les 7 dates ISO de la semaine (lundi→dimanche) contenant `iso`. */
export function weekDaysISO(iso: string): string[] {
  const d = fromISO(iso);
  const wd = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = addDaysISO(iso, -wd);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

/** « 24 juin – 5 juil. » pour une plage de dates ISO. */
export function rangeLabelISO(debut: string, fin: string): string {
  const a = fromISO(debut);
  const b = fromISO(fin);
  return `${a.getDate()} ${MOIS_COURT[a.getMonth()]} – ${b.getDate()} ${MOIS_COURT[b.getMonth()]}`;
}

/** Résumé de récurrence à partir des jours (0=lundi). */
export function daysSummary(jours: number[]): string {
  const s = [...jours].sort((a, b) => a - b);
  const eq = (arr: number[]) => arr.length === s.length && arr.every((v, i) => v === s[i]);
  if (eq([0, 1, 2, 3, 4])) return 'Lun–Ven';
  if (eq([0, 1, 2, 3, 4, 5, 6])) return 'Tous les jours';
  if (eq([5, 6])) return 'Week-end';
  return s.map((i) => SHORT[i]).join(', ');
}
