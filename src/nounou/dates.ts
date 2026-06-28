// Helpers de dates propres à la page Nounou (modèle par date YYYY-MM-DD).
// Réutilise la convention 0 = lundi, alignée avec Cuisine.

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
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
