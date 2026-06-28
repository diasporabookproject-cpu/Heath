// Projection d'un jour (§3) : ce qu'on affiche pour une date donnée.
// Précédence stricte : ponctuel > période > rythme habituel.

import type { MomentType, NounouDoc, Periode } from '../types';

export type Source = 'rythme' | 'periode' | 'ponctuel';

/** Une entrée du jour projeté, marquée par sa source (pour l'UI). */
export interface DayEntry {
  id: string;
  label: string;
  heure: string;
  type: MomentType;
  enfants: string[];
  qui?: string;
  lieu?: string;
  note?: string;
  source: Source;
}

/** Jour de semaine 0..6 (0 = lundi) d'une date YYYY-MM-DD, en heure locale. */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Une date (YYYY-MM-DD) est-elle dans [debut, fin] inclus ? */
function inRange(date: string, debut: string, fin: string): boolean {
  // Les chaînes YYYY-MM-DD se comparent lexicographiquement = chronologiquement.
  return date >= debut && date <= fin;
}

/**
 * Période active pour une date : celle qui contient la date. En cas de
 * chevauchement résiduel (la création est censée l'interdire), on prend la plus
 * récente (début le plus tardif) pour rester déterministe.
 */
export function activePeriode(doc: NounouDoc, dateISO: string): Periode | null {
  const matches = doc.periodes.filter((p) => inRange(dateISO, p.debut, p.fin));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => (a.debut < b.debut ? 1 : -1))[0];
}

/** Liste triée des entrées du jour `dateISO`, avec leur source. */
export function projectDay(doc: NounouDoc, dateISO: string): DayEntry[] {
  const wd = weekdayOf(dateISO);
  const per = activePeriode(doc, dateISO);
  const base = per ? per.rythme : doc.rythme;
  const source: Source = per ? 'periode' : 'rythme';

  const fromRythme: DayEntry[] = base
    .filter((m) => m.jours.includes(wd))
    .map((m) => ({
      id: m.id,
      label: m.label,
      heure: m.heure,
      type: m.type,
      enfants: m.enfants,
      qui: m.qui,
      lieu: m.lieu,
      note: m.note,
      source,
    }));

  const fromPonctuels: DayEntry[] = doc.ponctuels
    .filter((p) => p.date === dateISO)
    .map((p) => ({
      id: p.id,
      label: p.label,
      heure: p.heure,
      type: p.type,
      enfants: p.enfants,
      qui: p.qui,
      lieu: p.lieu,
      source: 'ponctuel' as Source,
    }));

  return [...fromRythme, ...fromPonctuels].sort((a, b) => a.heure.localeCompare(b.heure));
}

/** Deux plages de dates se chevauchent-elles ? (pour interdire à la création). */
export function periodesOverlap(
  a: { debut: string; fin: string },
  b: { debut: string; fin: string },
): boolean {
  return a.debut <= b.fin && b.debut <= a.fin;
}
