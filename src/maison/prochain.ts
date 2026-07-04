import type { MealKey, NounouDoc, Recipe, WeekMenu } from '../types';
import { projectDay } from '../nounou/projection';
import { todayISO } from '../nounou/dates';
import { todayKey } from '../cuisine/dates';
import { cleanText } from '../lib/sanitize';

// « Aujourd'hui » de Maison (L1-1) : agenda cross-rôles du jour = moments Nounou
// projetés (vraies heures) + repas Cuisine du jour aux heures conventionnelles.

export interface AgendaItem {
  time: string; // HH:MM
  label: string;
  picto: string;
  kind: 'cuisine' | 'nounou';
  past?: boolean;
}

// Heures d'affichage conventionnelles (décision produit — non réglables).
const MEAL_HOURS: Record<MealKey, string> = { petitdej: '08:00', dej: '12:30', diner: '20:00' };
const MEAL_PICTO: Record<MealKey, string> = { petitdej: '🥐', dej: '🥘', diner: '🌙' };
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit-déjeuner', dej: 'Déjeuner', diner: 'Dîner' };

const MOMENT_PICTO: Record<string, string> = {
  reveil: '⏰', ecole: '🏫', repas: '🍽️', sieste: '😴', gouter: '🍎',
  bain: '🛁', sortie: '🧺', sante: '🩺', coucher: '🌙', activite: '⚽', autre: '•',
};

/** Agenda du jour, trié par heure. */
export function agendaToday(doc: NounouDoc, week: WeekMenu, recipesById: Map<string, Recipe>): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const e of projectDay(doc, todayISO())) {
    items.push({ time: e.heure, label: e.label, picto: MOMENT_PICTO[e.type] ?? '•', kind: 'nounou' });
  }

  const day = week.days[todayKey()];
  if (day) {
    (['petitdej', 'dej', 'diner'] as MealKey[]).forEach((m) => {
      const platId = day[m]?.plat;
      if (platId) {
        const r = recipesById.get(platId);
        items.push({
          time: MEAL_HOURS[m],
          label: r ? cleanText(r.nom) : MEAL_LABEL[m],
          picto: MEAL_PICTO[m],
          kind: 'cuisine',
        });
      }
    });
  }

  return items.sort((a, b) => a.time.localeCompare(b.time));
}

/** Sépare le « Prochain » (1er élément à venir) du reste (timeline, passé marqué). */
export function splitProchain(
  items: AgendaItem[],
  nowHHMM: string,
): { prochain?: AgendaItem; timeline: AgendaItem[] } {
  if (items.length === 0) return { timeline: [] };
  const idx = items.findIndex((i) => i.time >= nowHHMM);
  const prochainIdx = idx === -1 ? items.length - 1 : idx;
  const prochain = items[prochainIdx];
  const timeline = items
    .filter((_, i) => i !== prochainIdx)
    .map((i) => ({ ...i, past: i.time < nowHHMM }));
  return { prochain, timeline };
}

export function nowHHMM(ref: Date = new Date()): string {
  return `${String(ref.getHours()).padStart(2, '0')}:${String(ref.getMinutes()).padStart(2, '0')}`;
}
